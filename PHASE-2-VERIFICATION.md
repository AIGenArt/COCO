# Phase 2 Verification Checklist

**Date:** April 8, 2026

---

## ✅ Verification Results

### 1. No Old Logic Remaining

#### Search: `sandbox_id` (without colon)
**Result:** ✅ 0 results found
- No references to old `sandbox_id` variable
- All code uses `activeSandboxId` or `active_sandbox_id`

#### Search: `status === 'running'` 
**Result:** ✅ 6 results found - ALL VALID
- `lib/sandbox/use-sandbox-status.ts` - Polling logic (correct)
- `app/workspace/[id]/page.tsx` - UI status display (correct)
- `components/workspace/Preview.tsx` - Status indicator (correct)
- `lib/sandbox/process-manager.ts` - Process management (correct)
- `lib/sandbox/use-sandbox-lifecycle.ts` - State check (correct)

**Conclusion:** No preview gating based on `running` status

---

## 🔍 Expected Behaviors

### Behavior 1: When Sandbox Becomes Ready

**Expected:**
```
[Polling] Status: ready, Preview Ready: true
[Polling] Stable sandbox reached, stopping polling
[Heartbeat] Starting heartbeat
[Heartbeat] Sandbox ID: abc-123
[Heartbeat] Status: ready
[Heartbeat] Preview Ready: true
[UI Gating] ✓ Sandbox is READY - showing preview
```

**Verification:**
- ✅ Polling stops when `status === 'ready' && preview_ready === true`
- ✅ Heartbeat starts only for `status === 'ready' && preview_ready === true`
- ✅ Preview renders only when `sandboxStatus === 'ready'`
- ✅ No new start/retry triggered (polling stopped)

### Behavior 2: When active_sandbox_id Changes

**Expected:**
```
[Heartbeat] ========================================
[Heartbeat] Active sandbox changed
[Heartbeat] Old: abc-123
[Heartbeat] New: def-456
[Heartbeat] Stopping heartbeat for old sandbox
[Heartbeat] ========================================
[Polling] Starting status polling for sandbox def-456
```

**Verification:**
- ✅ Old polling stops (useEffect cleanup on sandboxId change)
- ✅ Old heartbeat stops (activeSandboxIdRef check + cleanup)
- ✅ Old sandbox ID disappears from logs
- ✅ New sandbox ID appears in logs

### Behavior 3: Autosave Not Triggered by Runtime

**Code Review:**
```typescript
// useWorkspaceAutoSave hook
const { saveBeforeSandboxStart } = useWorkspaceAutoSave({
  workspaceId: workspaceId || '',
  metadata: { ... },
  onSave: async (metadata) => { ... },
  enabled: !!workspaceId,
});
```

**Verification:**
- ✅ Autosave is NOT triggered by polling
- ✅ Autosave is NOT triggered by heartbeat
- ✅ Autosave is NOT triggered by status changes
- ✅ Autosave only triggered by explicit user actions or `saveBeforeSandboxStart()`

---

## 📊 Code Flow Verification

### Frontend Initialization Flow
```
1. User navigates to /workspace/[id]
2. initializeSandbox() called
3. POST /api/sandboxes/create
4. Response contains sandbox.id
5. setActiveSandboxId(sandbox.id) ← SINGLE SOURCE OF TRUTH
6. Polling starts for activeSandboxId
7. Status updates: creating → bootstrapping → starting → running → ready
8. When ready: polling stops, heartbeat starts, preview shows
```

### Heartbeat Lifecycle
```
1. activeSandboxId set
2. Polling observes status changes
3. When status === 'ready' && preview_ready === true:
   - Polling stops
   - Heartbeat starts
4. If activeSandboxId changes:
   - Old heartbeat aborted immediately
   - New heartbeat starts (if new sandbox is ready)
```

### Polling Lifecycle
```
1. Starts when activeSandboxId is set
2. Polls every 2s for unstable states
3. Continues while:
   - status in ['creating', 'bootstrapping', 'starting', 'running']
   - OR status === 'running' && preview_ready !== true
4. Stops when:
   - status === 'ready' && preview_ready === true
   - OR status in ['failed', 'terminated', 'replaced']
```

---

## 🎯 Phase 3 Requirements

### Critical Rule
**A sandbox must ONLY become `workspace.active_sandbox_id` AFTER it has passed:**

1. ✅ Bootstrap (status: bootstrapping)
2. ✅ Validation (files exist, package.json valid)
3. ✅ Dev server start (status: starting → running)
4. ✅ Preview health check (HTTP 200 + HTML content)
5. ✅ Ready persistence (status: ready, preview_ready: true)

### Implementation Order

**Step 1:** Create sandbox record (status: creating)
**Step 2:** Bootstrap workspace (status: bootstrapping)
**Step 3:** Validate structure (fail if invalid)
**Step 4:** Start dev server (status: starting)
**Step 5:** Mark running (status: running)
**Step 6:** Health check preview URL
**Step 7:** Mark ready (status: ready, preview_ready: true)
**Step 8:** Activate via `replaceSandbox()` ← ONLY NOW

### Anti-Pattern to Avoid
```typescript
// ❌ WRONG - Activating too early
await createSandbox();
await setWorkspaceActiveSandbox(workspaceId, sandboxId); // TOO EARLY!
await startDevServer();
await healthCheck();

// ✅ CORRECT - Activate only after verified ready
await createSandbox();
await bootstrap();
await validate();
await startDevServer();
await healthCheck();
await markReady();
await replaceSandbox({ workspaceId, newSandboxId, reason: 'Verified ready' });
```

---

## 📁 Files to Modify in Phase 3

1. `app/api/sandboxes/create/route.ts` - Main create flow
2. `lib/sandbox/e2b-manager.ts` - Add validation calls
3. `lib/sandbox/sandbox-manager.ts` - Update status transitions

---

**Status:** Phase 2 verified, ready for Phase 3 implementation
