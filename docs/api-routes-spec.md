# COCO AI Actions API Specification

## Overview

The AI Actions API provides a secure, governed flow for planning, approving, and executing AI-assisted actions in COCO workspaces.

**Security Model:** Enforcement before features
- All routes use the complete guard chain
- Execute accepts ONLY action IDs, never raw payloads
- Approval is verified again at execution time
- Audit events written at every step (deny, approval, execution)

---

## Flow Diagram

```
User Request
    ↓
1. POST /api/ai/actions/plan
    ↓ (returns actionId)
    ↓
2. [If requires_approval]
   POST /api/ai/actions/{id}/approve
    ↓
3. POST /api/ai/actions/execute
    ↓ (with actionId only)
Result
```

---

## 1. Plan AI Action

**Endpoint:** `POST /api/ai/actions/plan`

**Purpose:** Evaluate an action without executing it. Returns normalized action with risk assessment and policy decision.

### Request

```typescript
{
  action: AIActionRequest
}
```

**AIActionRequest Types:**
```typescript
| { type: 'read_file'; workspaceId: string; path: string }
| { type: 'list_files'; workspaceId: string; path: string }
| { type: 'write_file'; workspaceId: string; path: string; content: string }
| { type: 'run_command'; workspaceId: string; command: string[]; env?: Record<string, string> }
| { type: 'commit_changes'; workspaceId: string; message: string }
| { type: 'open_pr'; workspaceId: string; title: string; body: string }
```

### Response (Success)

```typescript
{
  success: true,
  data: {
    actionId: string,              // Unique ID for this planned action
    action: AIActionRequest,       // Normalized action
    capability: AICapability,      // Required capability
    risk: AIRiskLevel,             // 'low' | 'medium' | 'high' | 'critical'
    decision: PolicyDecision,      // { outcome, reason, approvalType? }
    status: string,                // 'planned' | 'awaiting_approval'
    requiresApproval: boolean,
    createdAt: string              // ISO 8601 timestamp
  }
}
```

### Response (Error)

```typescript
{
  success: false,
  error: string
}
```

### Status Codes

- `200` - Success
- `400` - Invalid action request
- `401` - Unauthorized (no user session)
- `403` - Forbidden (workspace access denied, capability missing)
- `500` - Internal server error

### Guard Chain

1. ✅ `requireUser()` - Verify authenticated user
2. ✅ `assertWorkspaceAccess()` - Verify workspace ownership
3. ✅ `assertGitHubRepoAccessIfNeeded()` - Verify GitHub access (if needed)
4. ✅ `assertAICapability()` - Verify user has required capability
5. ✅ `classifyRisk()` - Determine risk level
6. ✅ `evaluatePolicy()` - Check policy decision
7. ✅ `auditAIEvent('ai_action_planned')` - Log to audit trail

### Example

```bash
curl -X POST http://localhost:3000/api/ai/actions/plan \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "type": "write_file",
      "workspaceId": "ws-123",
      "path": "src/App.tsx",
      "content": "export default function App() { return <div>Hello</div>; }"
    }
  }'
```

---

## 2. Approve AI Action

**Endpoint:** `POST /api/ai/actions/{id}/approve`

**Purpose:** Approve a planned action that requires approval.

### Request

```typescript
{
  reason: string  // Why user approved (required)
}
```

### Response (Success)

```typescript
{
  success: true,
  data: {
    actionId: string,
    status: 'approved',
    approvedBy: string,    // User ID
    approvedAt: string     // ISO 8601 timestamp
  }
}
```

### Response (Error)

```typescript
{
  success: false,
  error: string
}
```

### Status Codes

- `200` - Success
- `400` - Missing or invalid reason
- `401` - Unauthorized
- `403` - Forbidden (not your workspace)
- `404` - Action not found
- `409` - Conflict (action already approved/rejected/executed)
- `500` - Internal server error

### Validation

1. ✅ `requireUser()` - Verify authenticated user
2. ✅ Load action by ID
3. ✅ `assertWorkspaceAccess()` - Verify user owns workspace
4. ✅ Verify action status is 'awaiting_approval'
5. ✅ Update approval state
6. ✅ `auditApproval()` - Log approval

### Example

```bash
curl -X POST http://localhost:3000/api/ai/actions/action_123/approve \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Reviewed the changes and they look good"
  }'
```

---

## 2b. Reject AI Action

**Endpoint:** `DELETE /api/ai/actions/{id}/approve`

**Purpose:** Reject a planned action.

### Request

```typescript
{
  reason: string  // Why user rejected (required)
}
```

### Response (Success)

```typescript
{
  success: true,
  data: {
    actionId: string,
    status: 'rejected',
    rejectedBy: string,    // User ID
    rejectedAt: string     // ISO 8601 timestamp
  }
}
```

### Status Codes

Same as approve endpoint.

---

## 3. Execute AI Action

**Endpoint:** `POST /api/ai/actions/execute`

**Purpose:** Execute an approved action. **CRITICAL:** Only accepts action IDs, never raw action payloads.

### Request

```typescript
{
  actionId: string  // ONLY accepts IDs from plan endpoint
}
```

**Security Rule:** Raw action payloads are explicitly rejected to prevent bypassing the plan → approve flow.

### Response (Success)

```typescript
{
  success: true,
  data: AIActionResult  // Result from dispatcher
}
```

**AIActionResult:**
```typescript
{
  success: boolean,
  data?: any,
  error?: string,
  auditId?: string
}
```

### Response (Error)

```typescript
{
  success: false,
  error: string
}
```

### Status Codes

- `200` - Success
- `400` - Invalid request (missing actionId or raw payload provided)
- `401` - Unauthorized
- `403` - Forbidden (not approved, policy changed, workspace access denied)
- `404` - Action not found
- `409` - Conflict (already executed, rejected)
- `500` - Internal server error

### Critical Validation

1. ✅ `requireUser()` - Verify authenticated user
2. ✅ Load action by ID (NEVER accept raw action)
3. ✅ `assertWorkspaceAccess()` - Verify user owns workspace
4. ✅ Verify action status (not executed, not rejected)
5. ✅ **Re-run entire guard chain** (policy might have changed!)
6. ✅ Re-classify risk (file might have become sensitive)
7. ✅ Re-evaluate policy (decision might have changed)
8. ✅ Verify approval exists (if required)
9. ✅ `dispatchAction()` - Execute in sandbox
10. ✅ Update action status
11. ✅ `auditExecution()` - Log execution result

### Security Events

The execute endpoint logs security events for:
- Unknown action ID attempts
- Policy changes between plan and execute
- Execution without proper approval
- Approval from different user

### Example

```bash
curl -X POST http://localhost:3000/api/ai/actions/execute \
  -H "Content-Type: application/json" \
  -d '{
    "actionId": "action_1234567890_abc123"
  }'
```

---

## Error Codes Reference

### 400 - Bad Request
- Missing required fields
- Invalid action type
- Raw action payload provided to execute endpoint
- Invalid data format

### 401 - Unauthorized
- No user session
- Invalid authentication

### 403 - Forbidden
- Workspace access denied
- Missing required capability
- Action requires approval
- Policy changed to deny
- Action was rejected

### 404 - Not Found
- Action ID not found
- Workspace not found

### 409 - Conflict
- Action already approved
- Action already rejected
- Action already executed
- Invalid state transition

### 500 - Internal Server Error
- Database error
- Dispatcher error
- Unexpected system error

---

## Security Guarantees

### 1. No Bypass Possible
- Execute endpoint ONLY accepts action IDs
- Raw payloads are explicitly rejected
- All actions must go through plan → [approve] → execute

### 2. Policy Re-evaluation
- Guard chain runs again at execute time
- Risk is re-classified
- Policy decision is re-evaluated
- Prevents stale approvals from being exploited

### 3. Complete Audit Trail
- Plan: Logged with decision
- Approve/Reject: Logged with reason
- Execute: Logged with result
- Security events: Logged for suspicious activity

### 4. State Machine Enforcement
```
planned → awaiting_approval → approved → executed
                           ↘ rejected
```

No state can be skipped or bypassed.

---

## Rate Limiting (Future)

Recommended limits:
- Plan: 100 requests/minute per user
- Approve: 50 requests/minute per user
- Execute: 20 requests/minute per user

---

## Testing

### Test Plan Endpoint
```bash
# Low risk - should auto-allow
POST /api/ai/actions/plan
{ "action": { "type": "read_file", "workspaceId": "ws-1", "path": "README.md" } }

# Medium risk - should require approval
POST /api/ai/actions/plan
{ "action": { "type": "write_file", "workspaceId": "ws-1", "path": "src/App.tsx", "content": "..." } }

# Critical risk - should deny
POST /api/ai/actions/plan
{ "action": { "type": "write_file", "workspaceId": "ws-1", "path": ".env", "content": "..." } }
```

### Test Approve Endpoint
```bash
# Approve action
POST /api/ai/actions/{actionId}/approve
{ "reason": "Looks good" }

# Reject action
DELETE /api/ai/actions/{actionId}/approve
{ "reason": "Too risky" }
```

### Test Execute Endpoint
```bash
# Valid execution
POST /api/ai/actions/execute
{ "actionId": "action_123" }

# Should fail - raw payload
POST /api/ai/actions/execute
{ "action": { "type": "write_file", ... } }  # ❌ Rejected
```

---

## Migration Path

### Current (In-Memory)
- Actions stored in Map
- Cleared on server restart
- No persistence

### Next (Database)
- Replace action-store.ts with Supabase queries
- Add `ai_actions` table
- Add `ai_approvals` table
- Enable audit log persistence

---

**Version:** 1.0.0  
**Last Updated:** 2026-03-20  
**Status:** Production-Ready (In-Memory)
