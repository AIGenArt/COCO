# COCO AI Governance Framework

## Overview

COCO implements a comprehensive 4-layer AI governance framework that ensures secure, compliant, and accountable AI-assisted development.

## The 4 Governance Layers

### Sæt A: Access & Identity
**Who can AI act on behalf of?**

Controls authentication, workspace ownership, and capability-based access.

**Rules:**
- A1: AI må kun handle i verificeret bruger-kontekst
- A2: Workspace-ID giver aldrig adgang alene  
- A3: AI må kun bruge GitHub via backend
- A4: AI capabilities er rolle- og policy-styrede

**Implementation:** `lib/ai/guards.ts`

### Sæt B: Actions & Execution
**What can AI do?**

Controls which actions AI can propose and execute, with risk-based approval workflows.

**Rules:**
- B1: Standardmode er "read/propose only"
- B2: Write-handlinger kræver policy og approval
- B3: Højrisiko-handlinger kræver totrinskontrol
- B4: Runtime-eksekvering kun i isoleret sandbox
- B5: AI må ikke få udvidede privilegier

**Implementation:** `lib/ai/policy-engine.ts`, `lib/ai/dispatcher.ts`

### Sæt C: Data & Privacy
**What data can AI see and use?**

Controls data access, secret protection, and privacy compliance.

**Rules:**
- C1: Ingen hemmeligheder i prompts, logs eller output
- C2: Dataminimering er standard
- C3: Følsomme filer er policy-beskyttede
- C4: Prompting og retrieval klassificeres
- C5: Trænings- og retentionpolitik er eksplicit

**Implementation:** `lib/ai/redaction.ts`, `lib/ai/risk.ts`

### Sæt D: Audit & Accountability
**How is everything tracked and accountable?**

Ensures full traceability, clear responsibility, and compliance reporting.

**Rules:**
- D1: Alle AI-beslutninger er sporbare
- D2: Klar ansvarsplacering
- D3: AI-forslag og eksekvering adskilles
- D4: Governance-events er sikkerhedshændelser
- D5: Compliance-eksport er muligt

**Implementation:** `lib/ai/audit.ts`

---

## AI Operating Modes

### Mode 1: Read Only
- AI can only read workspace metadata and files
- No modifications allowed
- Lowest risk

### Mode 2: Propose Only (Default)
- AI can read and propose changes
- Shows diffs and suggestions
- No automatic execution
- User must manually apply changes

### Mode 3: Apply With Approval
- AI can propose and execute changes
- Requires user approval for each action
- Full audit trail
- Recommended for production

### Mode 4: Restricted Autonomy
- AI can execute low-risk actions autonomously
- Medium/high-risk actions require approval
- Strict policy enforcement
- Continuous monitoring

---

## Risk Classification

### Low Risk
- Reading files
- Listing directories
- Analyzing code

**Policy:** Auto-allow with capability

### Medium Risk
- Writing files (non-sensitive)
- Opening PRs
- Non-destructive operations

**Policy:** Depends on mode (propose-only vs apply-with-approval)

### High Risk
- Running commands
- Installing packages
- Git operations
- Modifying configuration

**Policy:** Always requires approval

### Critical Risk
- Modifying sensitive files (.env, auth, migrations)
- Dangerous commands (rm -rf, sudo, curl | bash)
- Security-related changes

**Policy:** Denied or admin-only approval

---

## Guard Chain

Every AI action goes through this security chain:

```typescript
1. requireUser()
   ↓ Verify authenticated user
   
2. assertWorkspaceAccess(workspaceId, userId)
   ↓ Verify workspace ownership
   
3. assertGitHubRepoAccessIfNeeded(workspace, userId)
   ↓ Verify GitHub installation & repo access (if needed)
   
4. assertAICapability(userId, workspaceId, capability)
   ↓ Verify user has required capability
   
5. classifyRisk(action)
   ↓ Determine risk level
   
6. evaluatePolicy(user, workspace, action, capability, risk)
   ↓ Check policy: allow / deny / require_approval
   
7. [If approval required] → Wait for user approval
   
8. dispatchAction(userId, workspace, action)
   ↓ Execute in isolated sandbox
   
9. auditOutcome(result)
   ↓ Log to audit trail
```

**No action can bypass this chain.**

---

## Capabilities

### Read Capabilities
- `ai:read_context` - Read workspace metadata
- `ai:list_files` - List directory contents
- `ai:read_file` - Read file contents
- `ai:read_logs` - Read execution logs

### Write Capabilities
- `ai:propose_patch` - Propose code changes
- `ai:write_file` - Write/modify files
- `ai:run_command` - Execute commands
- `ai:commit_changes` - Commit to Git
- `ai:open_pr` - Open GitHub PR

### Management Capabilities
- `ai:request_repo_sync` - Sync with GitHub repo

---

## Secret Protection

### Detected Patterns (20+)
- Generic: API keys, secrets, passwords, tokens
- OpenAI: `sk-...`
- GitHub: `ghp_...`, `gho_...`, `ghs_...`
- AWS: `AKIA...`
- Google: `AIza...`, `ya29...`
- Stripe: `sk_live_...`, `sk_test_...`
- Private keys: `-----BEGIN PRIVATE KEY-----`

### Protection Layers
1. **Before model call:** Redact secrets from prompts
2. **Before logging:** Redact secrets from audit logs
3. **Before output:** Redact secrets from AI responses

---

## Sensitive Files

These files trigger critical risk classification:

```
.env, .env.*
supabase/migrations/*
lib/auth/*
docs/rules.md
docs/ai-governance.md
lib/supabase/*
app/api/auth/*
middleware.ts
next.config.*
package.json
```

---

## Dangerous Commands

These commands are blocked or require admin approval:

```bash
rm -rf /
sudo
curl | bash
wget | sh
nc -l (netcat listener)
/dev/tcp (reverse shell)
fork bombs
crypto miners
```

---

## Audit Trail

Every AI action logs:

```typescript
{
  eventType: 'ai_action_planned' | 'ai_action_executed' | 'ai_action_denied',
  userId: string,
  workspaceId: string,
  actionType: 'read_file' | 'write_file' | 'run_command' | ...,
  capability: 'ai:read_file' | 'ai:write_file' | ...,
  risk: 'low' | 'medium' | 'high' | 'critical',
  decision: 'allow' | 'deny' | 'require_approval',
  reason: string,
  timestamp: ISO8601,
  metadata: {
    // Action-specific details (redacted)
  }
}
```

---

## API Routes

### Plan AI Action
```
POST /api/ai/actions/plan
Body: { action: AIActionRequest }
Response: { capability, risk, decision }
```

Evaluates an action without executing it.

### Execute AI Action
```
POST /api/ai/actions/execute
Body: { action: AIActionRequest }
Response: { success, data, error }
```

Executes an approved action.

### Approve AI Action
```
POST /api/ai/actions/:id/approve
Body: { reason: string }
Response: { success }
```

Approves a pending action.

---

## Database Schema

### ai_policies
```sql
- id: UUID
- workspace_id: UUID
- mode: 'read_only' | 'propose_only' | 'apply_with_approval' | 'restricted_autonomy'
- capabilities: JSONB
- restricted_paths: TEXT[]
- restricted_commands: TEXT[]
- max_tokens_per_request: INTEGER
- allowed_models: TEXT[]
- requires_approval_for: JSONB
- active: BOOLEAN
```

### ai_runs
```sql
- id: UUID
- workspace_id: UUID
- user_id: UUID
- model: TEXT
- prompt_hash: TEXT
- proposed_actions: JSONB
- approved_actions: JSONB
- rejected_actions: JSONB
- policy_id: UUID
- risk_level: TEXT
- capabilities_used: JSONB
- secrets_detected: BOOLEAN
- policy_violations: JSONB
- requires_approval: BOOLEAN
- approved_by: UUID
- approved_at: TIMESTAMPTZ
- executed: BOOLEAN
- executed_at: TIMESTAMPTZ
- execution_result: JSONB
```

### ai_approvals
```sql
- id: UUID
- ai_run_id: UUID
- user_id: UUID
- status: 'pending' | 'approved' | 'rejected'
- reason: TEXT
- actions: JSONB
- diff: TEXT
- created_at: TIMESTAMPTZ
- decided_at: TIMESTAMPTZ
```

---

## Usage Examples

### Example 1: Read File (Low Risk)
```typescript
const action = {
  type: 'read_file',
  workspaceId: 'ws-123',
  path: 'src/App.tsx'
};

// Guard chain runs
// Risk: low
// Decision: allow
// Result: File content returned
```

### Example 2: Write File (Medium Risk)
```typescript
const action = {
  type: 'write_file',
  workspaceId: 'ws-123',
  path: 'src/components/Button.tsx',
  content: '...'
};

// Guard chain runs
// Risk: medium
// Decision: require_approval (if in apply-with-approval mode)
// User approves
// Result: File written
```

### Example 3: Run Command (High Risk)
```typescript
const action = {
  type: 'run_command',
  workspaceId: 'ws-123',
  command: ['npm', 'test']
};

// Guard chain runs
// Risk: high
// Decision: require_approval
// User approves
// Result: Command executed in sandbox
```

### Example 4: Modify .env (Critical Risk)
```typescript
const action = {
  type: 'write_file',
  workspaceId: 'ws-123',
  path: '.env',
  content: 'API_KEY=...'
};

// Guard chain runs
// Risk: critical
// Decision: deny
// Result: Action blocked
```

---

## Compliance & Reporting

### Audit Export
```typescript
// Export all AI actions for a workspace
GET /api/ai/audit/export?workspaceId=ws-123&from=2024-01-01&to=2024-12-31

// Returns CSV/JSON with:
// - All AI runs
// - All approvals/rejections
// - All policy decisions
// - All security events
```

### Security Dashboard
- Total AI actions
- Approval rate
- Denied actions
- Security events
- Risk distribution
- Capability usage

---

## Best Practices

### For Developers
1. Always use the guard chain - never bypass
2. Log all decisions - even denials
3. Redact secrets before any external call
4. Classify risk conservatively
5. Test with real attack scenarios

### For Users
1. Review AI proposals before approving
2. Understand risk levels
3. Use propose-only mode for sensitive projects
4. Regularly review audit logs
5. Report suspicious AI behavior

### For Admins
1. Set appropriate policy modes per workspace
2. Monitor security events
3. Review high-risk approvals
4. Update sensitive file patterns
5. Conduct regular security audits

---

## Security Considerations

### Threat Model
- **Prompt injection:** Mitigated by policy engine
- **Secret leakage:** Mitigated by redaction
- **Privilege escalation:** Mitigated by capability system
- **Path traversal:** Mitigated by dispatcher validation
- **Command injection:** Mitigated by dangerous command blocking

### Defense in Depth
1. Guard chain (authentication & authorization)
2. Policy engine (decision making)
3. Risk classification (automatic assessment)
4. Dispatcher (execution control)
5. Audit logging (accountability)

---

## Future Enhancements

### Phase 2
- [ ] Data classification (C4)
- [ ] Retention policies (C5)
- [ ] Anomaly detection
- [ ] Automated remediation

### Phase 3
- [ ] Multi-tenant policies
- [ ] Organization-level governance
- [ ] Compliance templates (SOC 2, GDPR)
- [ ] Advanced threat detection

---

**Version:** 1.0.0  
**Last Updated:** 2026-03-20  
**Status:** Production Ready (Backend)
