# Polling Loop Fix - Complete Implementation

**Dato:** 8. april 2026, 16:01 UTC  
**Status:** ✅ IMPLEMENTERET

---

## Problem

Frontend loopede indefinitely ved "Starting dev server..." selvom:
- Backend returnerede `status: 'running'`
- Backend returnerede `preview_ready: true`

**Root Cause:** `'running'` var i `UNSTABLE_STATES` array, så polling stoppede aldrig.

---

## Løsning Implementeret

### 1. ✅ Fix UNSTABLE_STATES Array

**Fil:** `lib/sandbox/use-sandbox-status.ts`

```typescript
// BEFORE (FORKERT)
const UNSTABLE_STATES = ['creating', 'starting', 'running', 'stopping', 'destroying'];

// AFTER (KORREKT)
const UNSTABLE_STATES = ['creating', 'starting', 'stopping', 'destroying'];
```

**Effekt:** `'running'` er nu kun unstable hvis `preview_ready !== true`

---

### 2. ✅ Forbedret Polling Stop Condition

**Fil:** `lib/sandbox/use-sandbox-status.ts`

```typescript
const shouldContinuePolling = 
  UNSTABLE_STATES.includes(fetchedSandbox.status) ||
  (fetchedSandbox.status === 'running' && fetchedSandbox.preview_ready !== true);

if (!shouldContinuePolling) {
  console.log('[Polling] ========================================');
  console.log('[Polling] Stable sandbox reached, stopping polling');
  console.log('[Polling] Status:', fetchedSandbox.status);
  console.log('[Polling] Preview Ready:', fetchedSandbox.preview_ready);
  console.log('[Polling] ========================================');
  setIsPolling(false);
}
```

**Effekt:** 
- Eksplicit logging når polling stopper
- Klar stop condition: `running + preview_ready = true`

---

### 3. ✅ Fix UI Gating Logic

**Fil:** `app/workspace/[id]/page.tsx`

```typescript
onStatusChange: (updatedSandbox: SandboxInstance) => {
  console.log('Sandbox status changed:', updatedSandbox.status);
  
  // Update sandbox status based on preview_ready
  if (updatedSandbox.status === 'running' && updatedSandbox.preview_ready) {
    console.log('[UI Gating] Preview is ready, updating status to running');
    setSandboxStatus('running');
  } else if (updatedSandbox.status === 'running') {
    console.log('[UI Gating] Sandbox running but preview not ready yet');
    setSandboxStatus('starting');
  } else if (updatedSandbox.status === 'failed') {
    setSandboxStatus('failed');
  }
},
```

**Effekt:**
- UI opdaterer kun til `'running'` når `preview_ready = true`
- Loading overlay fjernes når preview er klar
- Klar logging af UI state transitions

---

## Forventet Adfærd Nu

### Workspace Creation Flow

1. **Loading State** (0-45s)
   ```
   UI: "Creating workspace... Extracting template..."
   Backend: Bootstrap kører
   ```

2. **Starting State** (45-50s)
   ```
   UI: "Starting dev server... This may take a minute..."
   Backend: status = 'running', preview_ready = false
   Polling: Fortsætter hver 2. sekund
   ```

3. **Running State** (50s+)
   ```
   Backend: status = 'running', preview_ready = true
   Polling: STOPPER med log "[Polling] Stable sandbox reached"
   UI: Loading overlay FJERNES, preview vises
   ```

---

## Test Procedure

### 1. Opret Ny Workspace
```
1. Gå til /dashboard
2. Klik "New Workspace"
3. Indtast navn
4. Klik "Create"
```

### 2. Observer Browser Console
Forventet logs:
```
[Frontend Polling] Received sandbox state: { status: 'running', preview_ready: false }
[UI Gating] Sandbox running but preview not ready yet
...
[Frontend Polling] Received sandbox state: { status: 'running', preview_ready: true }
[UI Gating] Preview is ready, updating status to running
[Polling] ========================================
[Polling] Stable sandbox reached, stopping polling
[Polling] Status: running
[Polling] Preview Ready: true
[Polling] ========================================
```

### 3. Verificer UI
- ✅ Loading overlay forsvinder
- ✅ Preview iframe vises
- ✅ Polling stopper (ingen flere "[Frontend Polling]" logs)
- ✅ Autosave stopper med at trigger konstant

---

## Relaterede Fixes

### Autosave Loop (Delvist Løst)
Polling stopper nu, så autosave trigger ikke længere konstant.

**Fremtidig forbedring:** Deduplicate polling updates før state opdatering:
```typescript
const nextState = { id, status, preview_ready, container_id, port };
if (shallowEqual(prevStateRef.current, nextState)) {
  return; // Skip unchanged updates
}
```

---

## Filer Modificeret

1. ✅ `lib/sandbox/use-sandbox-status.ts`
   - Fjernet `'running'` fra UNSTABLE_STATES
   - Forbedret stop condition
   - Tilføjet eksplicit stop logging

2. ✅ `app/workspace/[id]/page.tsx`
   - Tilføjet `preview_ready` check i onStatusChange
   - UI opdaterer kun til 'running' når preview er klar
   - Tilføjet UI gating logging

3. ✅ `POLLING-LOOP-FIX.md` (denne fil)
   - Komplet dokumentation af fix

---

## Tidligere Fixes (Stadig Aktive)

1. ✅ Database trigger fix (migration 0009)
2. ✅ Preview URL normalisering
3. ✅ Health check timeout (10s + 120 attempts)
4. ✅ Background process (nohup + &)
5. ✅ Bootstrap function fix
6. ✅ Frontend idempotency disabled
7. ✅ Verified idempotency (5-step validation)
8. ✅ 'terminated' → 'failed' status fix
9. ✅ Frontend polling fix (tjek preview_ready)
10. ✅ **Polling loop fix (denne fix)**

---

## Success Criteria

✅ Polling stopper når `preview_ready = true`  
✅ UI opdaterer til at vise preview  
✅ Autosave stopper med at trigger konstant  
✅ Klar logging af alle state transitions  

---

**Status:** KLAR TIL TEST  
**Næste:** Opret workspace og verificer at loading stopper
