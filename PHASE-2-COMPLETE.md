# Phase 2 Complete: Frontend Active Sandbox Architecture

**Status:** Phase 2 Complete - Frontend Wired to New Model  
**Date:** April 8, 2026

---

## ✅ Phase 2: Completed

### 1. Heartbeat Stale Closure Fix ✅
**File:** `lib/sandbox/use-sandbox-heartbeat.ts`

**Changes:**
- Added `activeSandboxIdRef` to track current sandbox ID
- Added `abortControllerRef` to cancel pending requests
- IMMEDIATE cleanup when sandbox ID changes
- Only runs for `status === 'ready'` AND `preview_ready === true`
- Comprehensive logging for debugging

**Key Code:**
```typescript
// IMMEDIATE cleanup if sandbox ID changed
if (activeSandboxIdRef.current && activeSandboxIdRef.current !== sandboxId) {
  console.log('[Heartbeat] Active sandbox changed');
  abortControllerRef.current?.abort();
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
  }
}
```

### 2. Polling Logic Updated ✅
**File:** `lib/sandbox/use-sandbox-status.ts`

**Changes:**
- Added `'bootstrapping'` to UNSTABLE_STATES
- Added `'running'` to UNSTABLE_STATES (poll until 'ready')
- Updated STABLE_STATES to include `'ready'`, `'terminated'`, `'replaced'`
- Poll continues until `status === 'ready' && preview_ready === true`

**Key Code:**
```typescript
const UNSTABLE_STATES: SandboxStatus[] = [
  'creating',
  'bootstrapping',
  'starting',
  'running',  // Poll until 'ready'
];

const shouldContinuePolling = 
  UNSTABLE_STATES.includes(fetchedSandbox.status) ||
  (fetchedSandbox.status === 'running' && fetchedSandbox.preview_ready !== true);
```

### 3. Frontend Uses active_sandbox_id ✅
**File:** `app/workspace/[id]/page.tsx`

**Changes:**
- Renamed `sandboxId` state to `activeSandboxId`
- Updated all references to use `activeSandboxId`
- Added comprehensive UI gating logs
- Updated loading overlay to show all statuses
- Pass `previewReady` to heartbeat hook

**Key Changes:**
```typescript
// State
const [activeSandboxId, setActiveSandboxId] = useState<string | null>(null);

// Polling ONLY for active sandbox
const { sandbox } = useSandboxStatus({
  sandboxId: activeSandboxId,
  enabled: !!activeSandboxId,
});

// Heartbeat ONLY for ready sandbox
useSandboxHeartbeat({
  sandboxId: activeSandboxId,
  status: sandbox?.status || null,
  previewReady: sandbox?.preview_ready,
  enabled: !!activeSandboxId && !!workspaceId,
});
```

### 4. UI Gating on 'ready' Status ✅
**File:** `app/workspace/[id]/page.tsx`

**Changes:**
- Loading overlay shows for: `loading`, `bootstrapping`, `starting`, `running`
- Preview only shown when `status === 'ready'`
- Detailed status messages for each phase
- Shows sandbox ID in loading overlay for debugging

**Status Messages:**
- `loading`: "Creating sandbox..."
- `bootstrapping`: "Validating workspace..."
- `starting`: "Installing dependencies..."
- `running`: "Starting dev server..."
- `ready`: Preview shown (no overlay)

### 5. Comprehensive Logging ✅

**Added logs for:**
- `[Heartbeat]` - Start/stop, ID changes, abort events
- `[UI Gating]` - Status changes, preview ready state
- `[Workspace]` - Initialization, active sandbox ID setting
- `[Polling]` - Status updates, stable state reached

---

## 📊 Architecture Compliance

### Single Source of Truth ✅
```
Frontend ONLY observes: workspace.active_sandbox_id
No fallback to old sandbox_id
No "latest sandbox" logic
No local stale sandbox references
```

### Heartbeat Rules ✅
```
Runs ONLY when:
- sandbox.id === workspace.active_sandbox_id
- sandbox.status === 'ready'
- sandbox.preview_ready === true
```

### UI Preview Gating ✅
```
Preview shown ONLY when:
- status === 'ready'
- preview_ready === true
```

### Polling Rules ✅
```
Unstable states (poll continues):
- creating
- bootstrapping
- starting
- running

Stable states (polling stops):
- ready (success)
- terminated
- failed
- replaced
```

---

## 🔍 Logging Examples

### Heartbeat Logs
```
[Heartbeat] ========================================
[Heartbeat] Active sandbox changed
[Heartbeat] Old: abc-123
[Heartbeat] New: def-456
[Heartbeat] Stopping heartbeat for old sandbox
[Heartbeat] ========================================
```

### UI Gating Logs
```
[UI Gating] ========================================
[UI Gating] Sandbox status changed: ready
[UI Gating] Preview ready: true
[UI Gating] Sandbox ID: abc-123
[UI Gating] Active sandbox ID: abc-123
[UI Gating] ✓ Sandbox is READY - showing preview
[UI Gating] ========================================
```

### Polling Logs
```
[Polling] ========================================
[Polling] Stable sandbox reached, stopping polling
[Polling] Status: ready
[Polling] Preview Ready: true
[Polling] Container ID: abc-123
[Polling] ========================================
```

---

## 🎯 Success Criteria

- ✅ Frontend uses ONLY `active_sandbox_id`
- ✅ Heartbeat NEVER targets stale IDs
- ✅ Heartbeat runs ONLY for `ready` + `preview_ready`
- ✅ UI gates on `status === 'ready'`
- ✅ Polling includes all new statuses
- ✅ Comprehensive logging added
- ⏳ Backend flow (Phase 3)

---

## 📁 Files Modified

### Phase 2 Changes
1. ✅ `lib/sandbox/use-sandbox-heartbeat.ts` - Fixed stale closure
2. ✅ `lib/sandbox/use-sandbox-status.ts` - Updated polling logic
3. ✅ `app/workspace/[id]/page.tsx` - Uses active_sandbox_id, UI gating

---

## 🚀 Next Steps: Phase 3

### Backend Create Flow
**File:** `app/api/sandboxes/create/route.ts`

**Required changes:**
1. Add bootstrap validation before dev server
2. Add health check before marking `preview_ready`
3. Use `replaceSandbox()` for atomic activation
4. Transition through all statuses: `creating` → `bootstrapping` → `starting` → `running` → `ready`

**Flow:**
```typescript
1. Create provider sandbox (status: creating)
2. Bootstrap workspace (status: bootstrapping)
3. Validate structure (fail if invalid)
4. Start dev server (status: starting)
5. Mark running (status: running)
6. Health check preview URL
7. Mark ready (status: ready, preview_ready: true)
8. Activate via replaceSandbox()
```

---

**Status:** Phase 2 complete, ready for Phase 3 backend implementation
