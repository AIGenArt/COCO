# COCO Database Schema Documentation

## Overview

Production-grade database schema for AI governance with RLS, constraints, and state machine enforcement at the database level.

**Key Principles:**
- State machine enforced by database constraints
- RLS on all tables
- Audit trail is not optional
- Policy versioning for compliance
- First-class approval tracking

---

## Tables

### 1. `ai_policies`
**Purpose:** Defines governance policies per workspace

**Key Features:**
- Policy versioning (critical for audit trail)
- JSONB for flexible capabilities and approval lists
- Active/inactive status
- Updated_at trigger

**Columns:**
- `id` - UUID primary key
- `workspace_id` - UUID (not FK to allow flexibility)
- `name` - Policy name
- `mode` - Governance mode (read_only, propose_only, apply_with_approval, restricted_autonomy)
- `capabilities` - JSONB array of capability strings
- `restricted_paths` - TEXT[] of path patterns
- `restricted_commands` - TEXT[] of command patterns
- `max_tokens_per_request` - INTEGER limit
- `allowed_models` - TEXT[] of model names
- `requires_approval_for` - JSONB array of action types
- `version` - TEXT policy version (e.g., "1.0.0")
- `active` - BOOLEAN status
- `created_at`, `updated_at` - Timestamps
- `created_by` - UUID reference to auth.users

**RLS:**
- Users can view/create/update policies for own workspaces only

---

### 2. `ai_actions`
**Purpose:** State authority for all AI actions

**Key Features:**
- **State machine enforced by database constraints**
- Cannot execute without approval (for high-risk actions)
- Cannot change status of executed/rejected actions
- Policy version captured for audit trail

**Columns:**
- `id` - UUID primary key
- `workspace_id` - UUID
- `user_id` - UUID reference to auth.users
- `action_type` - TEXT (read_file, list_files, write_file, run_command, commit_changes, open_pr)
- `action_payload` - JSONB (full action details)
- `capability` - TEXT (required capability)
- `risk_level` - TEXT (low, medium, high, critical)
- `policy_id` - UUID reference to ai_policies
- `policy_version` - TEXT (captured at evaluation time)
- `policy_decision` - JSONB (full decision object)
- `status` - TEXT (planned, awaiting_approval, approved, rejected, executed, failed)
- `approved_by`, `approved_at`, `approval_reason` - Approval tracking
- `rejected_by`, `rejected_at`, `rejection_reason` - Rejection tracking
- `executed_at`, `execution_result` - Execution tracking
- `secrets_detected` - BOOLEAN flag
- `policy_violations` - JSONB array
- `created_at` - Timestamp

**State Machine Constraints:**
```sql
-- Approved status requires approval fields
CONSTRAINT valid_approval CHECK (
  (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  OR (status != 'approved')
)

-- Rejected status requires rejection fields
CONSTRAINT valid_rejection CHECK (
  (status = 'rejected' AND rejected_by IS NOT NULL AND rejected_at IS NOT NULL)
  OR (status != 'rejected')
)

-- Executed status requires execution timestamp
CONSTRAINT valid_execution CHECK (
  (status = 'executed' AND executed_at IS NOT NULL)
  OR (status != 'executed')
)

-- Cannot execute high-risk actions without approval
CONSTRAINT no_execute_without_approval CHECK (
  (status = 'executed' AND (approved_by IS NOT NULL OR risk_level = 'low'))
  OR (status != 'executed')
)
```

**State Machine Trigger:**
```sql
-- Enforces valid state transitions
-- Cannot change status of executed actions
-- Cannot change status of rejected actions
-- Can only approve planned/awaiting_approval actions
-- Can only execute approved/planned actions
```

**RLS:**
- Users can view/create/update own actions only

---

### 3. `ai_action_approvals`
**Purpose:** First-class approval tracking (not just a field)

**Key Features:**
- Separate table for approval history
- Captures snapshot of what was approved
- Optional diff for code changes
- Decided_at timestamp

**Columns:**
- `id` - UUID primary key
- `action_id` - UUID reference to ai_actions (CASCADE delete)
- `user_id` - UUID reference to auth.users
- `status` - TEXT (pending, approved, rejected)
- `reason` - TEXT (required explanation)
- `actions_snapshot` - JSONB (what was approved/rejected)
- `diff` - TEXT (optional code diff)
- `created_at`, `decided_at` - Timestamps

**Constraints:**
```sql
-- Decided status requires decided_at timestamp
CONSTRAINT valid_decision CHECK (
  (status IN ('approved', 'rejected') AND decided_at IS NOT NULL)
  OR (status = 'pending')
)
```

**RLS:**
- Users can view/create/update approvals for own actions only

---

### 4. `ai_policy_decisions`
**Purpose:** Audit trail for every policy evaluation

**Key Features:**
- Captures decision context at evaluation time
- Policy version for compliance
- Evaluation performance tracking

**Columns:**
- `id` - UUID primary key
- `action_id` - UUID reference to ai_actions (CASCADE delete)
- `policy_id` - UUID reference to ai_policies
- `decision` - TEXT (allow, deny, require_approval)
- `reason` - TEXT (explanation)
- `risk_level` - TEXT (at decision time)
- `capability` - TEXT (required capability)
- `policy_version` - TEXT (policy version used)
- `evaluation_time_ms` - INTEGER (performance metric)
- `created_at` - Timestamp

**RLS:**
- Users can view policy decisions for own actions
- Service role can insert

---

### 5. `ai_audit_logs`
**Purpose:** Complete audit trail (not optional)

**Key Features:**
- All governance events logged
- Security event flag
- Metadata redacted
- Indexed for fast queries

**Columns:**
- `id` - UUID primary key
- `user_id` - UUID reference to auth.users
- `workspace_id` - UUID
- `action_id` - UUID reference to ai_actions (SET NULL on delete)
- `event_type` - TEXT (event name)
- `severity` - TEXT (low, medium, high, critical)
- `action_type` - TEXT (optional)
- `capability` - TEXT (optional)
- `risk_level` - TEXT (optional)
- `decision` - TEXT (optional)
- `reason` - TEXT (optional)
- `metadata` - JSONB (redacted additional data)
- `is_security_event` - BOOLEAN flag
- `created_at` - Timestamp

**RLS:**
- Users can view own audit logs
- Service role can insert

---

### 6. `auth_events`
**Purpose:** Authentication audit trail

**Key Features:**
- All auth events logged
- IP and user agent captured
- Success/failure tracking

**Columns:**
- `id` - UUID primary key
- `user_id` - UUID reference to auth.users
- `event_type` - TEXT (signup, login, logout, password_reset, email_confirm, mfa_enable, mfa_disable)
- `ip_address` - INET
- `user_agent` - TEXT
- `success` - BOOLEAN
- `error_message` - TEXT (optional)
- `created_at` - Timestamp

**RLS:**
- Users can view own auth events
- Service role can insert

---

## Views

### `pending_approvals`
**Purpose:** Quick access to actions awaiting approval

```sql
SELECT 
  a.id,
  a.workspace_id,
  a.user_id,
  a.action_type,
  a.risk_level,
  a.created_at,
  a.action_payload
FROM ai_actions a
WHERE a.status = 'awaiting_approval'
ORDER BY a.created_at DESC;
```

### `security_events`
**Purpose:** Quick access to security-related audit events

```sql
SELECT 
  id,
  user_id,
  workspace_id,
  event_type,
  severity,
  reason,
  created_at
FROM ai_audit_logs
WHERE is_security_event = true
ORDER BY created_at DESC;
```

---

## Functions & Triggers

### `update_updated_at_column()`
**Purpose:** Automatically update updated_at timestamp

**Applied to:**
- `ai_policies`

### `enforce_action_state_machine()`
**Purpose:** Enforce valid state transitions

**Rules:**
- Cannot change status of executed actions
- Cannot change status of rejected actions
- Can only approve planned/awaiting_approval actions
- Can only execute approved/planned actions

**Applied to:**
- `ai_actions` (BEFORE UPDATE)

---

## Indexes

### Performance Indexes
```sql
-- ai_policies
idx_ai_policies_workspace_id
idx_ai_policies_active (WHERE active = true)

-- ai_actions
idx_ai_actions_workspace_id
idx_ai_actions_user_id
idx_ai_actions_status
idx_ai_actions_created_at (DESC)
idx_ai_actions_risk_level

-- ai_action_approvals
idx_ai_action_approvals_action_id
idx_ai_action_approvals_user_id
idx_ai_action_approvals_status

-- ai_policy_decisions
idx_ai_policy_decisions_action_id
idx_ai_policy_decisions_decision
idx_ai_policy_decisions_created_at (DESC)

-- ai_audit_logs
idx_ai_audit_logs_user_id
idx_ai_audit_logs_workspace_id
idx_ai_audit_logs_action_id
idx_ai_audit_logs_event_type
idx_ai_audit_logs_severity
idx_ai_audit_logs_created_at (DESC)
idx_ai_audit_logs_security_events (WHERE is_security_event = true)

-- auth_events
idx_auth_events_user_id
idx_auth_events_event_type
idx_auth_events_created_at (DESC)
idx_auth_events_failed (WHERE success = false)
```

---

## State Machine

### Valid State Transitions

```
planned → awaiting_approval → approved → executed
                           ↘ rejected

planned → executed (only for low-risk actions)
```

### Enforced by Database

1. **Constraints** - Prevent invalid states
2. **Triggers** - Prevent invalid transitions
3. **RLS** - Prevent unauthorized changes

---

## Security Guarantees

### 1. State Authority
- Database is the single source of truth
- Backend cannot bypass state machine
- Invalid transitions are rejected by database

### 2. Audit Trail
- All events logged automatically
- Cannot delete audit logs (only service role)
- Timestamps are immutable

### 3. Policy Versioning
- Every action captures policy version
- Can explain historical decisions
- Compliance-ready

### 4. RLS Enforcement
- Users can only access own data
- Service role for system operations
- No cross-user data leakage

---

## Migration Path

### From In-Memory to Database

1. **Update action-store.ts** to use Supabase queries
2. **Update guards.ts** to load from database
3. **Update policy-engine.ts** to load policies from database
4. **Update audit.ts** to write to database
5. **Test state machine enforcement**
6. **Verify RLS policies**

### Backward Compatibility

- In-memory store can coexist during migration
- Gradual rollout possible
- Fallback to in-memory if database unavailable

---

## Compliance Features

### GDPR Ready
- User data isolated by RLS
- Audit trail for data access
- Can export user's audit logs

### SOC 2 Ready
- Complete audit trail
- Access controls (RLS)
- Change tracking (updated_at)
- Security event logging

### Compliance Export
```sql
-- Export all actions for a user
SELECT * FROM ai_actions WHERE user_id = $1;

-- Export all audit logs for a user
SELECT * FROM ai_audit_logs WHERE user_id = $1;

-- Export all approvals for a user
SELECT * FROM ai_action_approvals WHERE user_id = $1;
```

---

## Performance Considerations

### Query Optimization
- All foreign keys indexed
- Timestamp columns indexed (DESC for recent-first queries)
- Partial indexes for common filters (active policies, security events, failed auth)

### Retention Policy
- Consider archiving old audit logs (>1 year)
- Keep action history for compliance period
- Compress old execution results

---

## Monitoring Queries

### Pending Approvals Count
```sql
SELECT COUNT(*) FROM pending_approvals;
```

### Security Events (Last 24h)
```sql
SELECT * FROM security_events 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Failed Auth Attempts
```sql
SELECT * FROM auth_events 
WHERE success = false 
AND created_at > NOW() - INTERVAL '1 hour';
```

### High-Risk Actions
```sql
SELECT * FROM ai_actions 
WHERE risk_level IN ('high', 'critical')
AND created_at > NOW() - INTERVAL '7 days';
```

---

**Version:** 1.0.0  
**Last Updated:** 2026-03-20  
**Status:** Production-Ready
