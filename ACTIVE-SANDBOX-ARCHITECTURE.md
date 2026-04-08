# Active Sandbox Architecture - Implementation Guide

**Status:** Phase 1 & 2 Complete - Phase 3 In Progress  
**Date:** April 8, 2026

---

## 🎯 Architecture Overview

### Single Source of Truth
```
workspace.active_sandbox_id → THE ONLY sandbox frontend observes
```

### Core Principle
**One workspace → One active sandbox → One valid preview**

---

## ✅ Phase 1: Completed

### 1. Database Migration
**File:** `supabase/migrations/0010_active_sandbox_architecture.sql`

- ✅ Added `active_sandbox_id` to workspaces (backward compatible)
- ✅ Added new statuses: `bootstrapping`, `ready`, `replaced`
- ✅ Added `bootstrap_mode` and `replaced_by_sandbox_id` columns
- ✅ Migrated existing `sandbox_id` → `active_sandbox_id`
- ✅ Added indexes for performance

### 2. TypeScript Types
**File:** `lib/sandbox/types.ts`

- ✅ Updated `SandboxStatus` with production-grade states
- ✅ Added `BootstrapMode` type
- ✅ Added `Workspace` interface with `active_sandbox_id`
- ✅ Updated `SandboxInstance` interface
- ✅ Added `BootstrapValidationResult` type
- ✅ Added `PreviewHealthResult` type
- ✅ Updated state machine transitions

### 3. Bootstrap Service
**File:** `lib/sandbox/bootstrap-service.ts`

- ✅ `validateWorkspaceStructure()` - Validates required files
- ✅ Checks package.json validity
- ✅ Verifies scripts.dev exists
- ✅ Confirms Next.js dependencies
- ✅ Template materialization (placeholder)
- ✅ Repo materialization (placeholder)

### 4. Health Service
**File:** `lib/sandbox/preview-health.ts`

- ✅ `checkPreviewHealth()` - Production-grade health check
- ✅ Uses GET instead of HEAD
- ✅ Validates content-type is HTML
- ✅ Proper timeout handling
- ✅ `waitForPreviewReady()` - Retry logic
- ✅ `monitorPreviewHealth()` - Continuous monitoring

### 5. Lifecycle Service
**File:** `lib/sandbox/lifecycle-service.ts`

- ✅ `getActiveSandbox()` - Get workspace's active sandbox
- ✅ `replaceSandbox()` - Atomic sandbox replacement
- ✅ `isSandboxReusable()` - Reusability check
- ✅ `getSandboxById()` - Fetch sandbox by ID
- ✅ `setWorkspaceActiveSandbox()` - Direct update

---

## ✅ Phase 2: Completed (Critical Fixes)

### Fix 1: Heartbeat Stale Closure
**File:** `lib/sandbox/use-sandbox-heartbeat.ts`

**Problem:** Heartbeat continues for old sandbox after ID changes

**Solution:**
```typescript
const activeSandboxIdRef = useRef<string | null>(null);
const abortControllerRef = useRef<AbortController | null>(null);

useEffect(() => {
  // IMMEDIATE cleanup on ID change
  if (activeSandboxIdRef.current !== sandboxId) {
    console.log('[Heartbeat] Active sandbox changed');
    abortControllerRef.current?.abort();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }
  
  activeSandboxIdRef.current = sandboxId;
  // Start new heartbeat...
}, [sandboxId]);
```

### Fix 2: Frontend Uses active_sandbox_id
**File:** `app/workspace/[id]/page.tsx`

**Changes:**
1. Fetch workspace to get `active_sandbox_id`
2. Use ONLY `active_sandbox_id` for polling/heartbeat
3. Atomic cleanup on sandbox ID change

### Fix 3: Gate on 'ready' Status
**File:** `app/workspace/[id]/page.tsx`

**Current:** Gates on `status === 'running'`  
**New:** Gate on `status === 'ready' && preview_ready === true`

```typescript
const isSandboxReady =
  sandbox?.id === activeSandboxId &&
  sandbox?.status === 'ready' &&
  sandbox?.preview_ready === true &&
  !!sandbox?.preview_url;
```

### Fix 4: Update Polling Logic
**File:** `lib/sandbox/use-sandbox-status.ts`

**Update UNSTABLE_STATES:**
```typescript
const UNSTABLE_STATES = [
  'creating',
  'bootstrapping',
  'starting',
  'running',  // Poll until 'ready'
];

const shouldContinuePolling =
  UNSTABLE_STATES.includes(status) ||
  (status === 'running' && !preview_ready);
```

---

## 🏗️ Phase 3: Backend Flow (Major Refactor)

### Complete Create Flow
**File:** `app/api/sandboxes/create/route.ts`

**New Flow:**
```typescript
async function createAndActivateSandbox(workspaceId: string) {
  // 1. Create provider sandbox
  const provider = await E2BManager.createSandbox();
  
  // 2. Create DB record
  const sandbox = await createSandboxRecord({
    workspaceId,
    providerSandboxId: provider.id,
    status: 'creating',
  });
  
  // 3. Bootstrap
  await updateSandbox(sandbox.id, { status: 'bootstrapping' });
  const validation = await validateWorkspaceStructure(...);
  if (!validation.ok) {
    await markFailed(sandbox.id, validation);
    throw new Error('Bootstrap validation failed');
  }
  
  // 4. Start runtime
  await updateSandbox(sandbox.id, { status: 'starting' });
  await startDevServer(sandbox.id);
  
  // 5. Mark running
  await updateSandbox(sandbox.id, {
    status: 'running',
    port: 3000,
    preview_url: previewUrl,
  });
  
  // 6. Health check
  const health = await checkPreviewHealth(previewUrl);
  if (health.status !== 'ready') {
    await markFailed(sandbox.id, health.error);
    throw new Error('Preview health failed');
  }
  
  // 7. Mark ready
  await updateSandbox(sandbox.id, {
    status: 'ready',
    preview_ready: true,
  });
  
  // 8. Activate (atomic replacement)
  await replaceSandbox({
    workspaceId,
    newSandboxId: sandbox.id,
    reason: 'Activated verified ready sandbox',
  });
  
  return sandbox.id;
}
```

---

## 📊 State Machine

### Valid Transitions
```
creating → bootstrapping → starting → running → ready
ready → stopping → terminated
ready → replaced (when new sandbox becomes active)
Any operational state → failed (on error)
```

### Critical Rules
1. **Only 'ready' may be previewed or heartbeated**
2. **'replaced' is for old sandboxes superseded by new active**
3. **'terminated' is normal end state**
4. **'failed' is error end state**

---

## 🎯 Success Criteria

- ✅ One `active_sandbox_id` per workspace
- ✅ Frontend observes ONLY active sandbox
- ✅ Heartbeat NEVER targets stale IDs
- ✅ UI gates on `status === 'ready'`
- ✅ Polling includes all new statuses
- ⏳ `preview_ready` ONLY after health check (Phase 3)
- ⏳ Bootstrap validation before dev server (Phase 3)
- ⏳ Atomic sandbox replacement (Phase 3)

---

## 📁 Files Created/Modified

### Created
1. `supabase/migrations/0010_active_sandbox_architecture.sql`
2. `lib/sandbox/bootstrap-service.ts`
3. `lib/sandbox/lifecycle-service.ts`
4. `ACTIVE-SANDBOX-ARCHITECTURE.md` (this file)

### Modified
1. `lib/sandbox/types.ts` - Updated types
2. `lib/sandbox/preview-health.ts` - Simplified health check

### Phase 2 (Completed)
1. ✅ `lib/sandbox/use-sandbox-heartbeat.ts` - Fixed stale closure
2. ✅ `app/workspace/[id]/page.tsx` - Uses active_sandbox_id
3. ✅ `lib/sandbox/use-sandbox-status.ts` - Updated polling logic

### Phase 3 (In Progress)
1. ⏳ `app/api/sandboxes/create/route.ts` - Complete flow with validation
2. ⏳ `lib/sandbox/e2b-manager.ts` - Add bootstrap integration

---

## 🚀 Deployment Strategy

### Step 1: Run Migration
```bash
# Apply migration to add active_sandbox_id
supabase db push
```

### Step 2: Deploy Phase 1 Code
- New services (bootstrap, lifecycle, health)
- Updated types
- Backward compatible (reads both sandbox_id and active_sandbox_id)

### Step 3: Implement Phase 2 Fixes
- Fix heartbeat stale closure
- Update frontend to use active_sandbox_id
- Update polling logic

### Step 4: Implement Phase 3 Backend
- Complete create flow with all steps
- Health check before ready
- Bootstrap validation
- Atomic activation

### Step 5: Verify & Monitor
- Test workspace creation end-to-end
- Verify no stale heartbeats
- Confirm preview ready works
- Monitor for errors

### Step 6: Cleanup (Later)
```sql
-- After verification, drop old column
ALTER TABLE workspaces DROP COLUMN IF EXISTS sandbox_id;
```

---

## 🔧 Testing Checklist

- [ ] Migration runs successfully
- [ ] New sandbox created with 'creating' status
- [ ] Bootstrap validation catches missing files
- [ ] Health check verifies HTML response
- [ ] Sandbox transitions to 'ready' only after health check
- [ ] Frontend shows preview only when status = 'ready'
- [ ] Heartbeat stops when sandbox ID changes
- [ ] Old sandbox marked 'replaced' when new becomes active
- [ ] No stale heartbeats in logs
- [ ] Polling stops when preview_ready = true

---

**Next Action:** Implement Phase 3 backend flow (bootstrap validation, health check, atomic activation)
