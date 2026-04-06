# COCO Sandbox Debug Rapport
**Dato:** 6. april 2026  
**Status:** Under investigation - Preview fejler med 400 error

---

## Executive Summary

COCO workspace preview fejler konsekvent med HTTP 400 error. Gennem omfattende debugging er flere root causes identificeret og fixet, men problemet persisterer. Denne rapport dokumenterer alle fund, fixes og den nuværende status.

---

## 1. Problemstilling

### Symptomer
- ✅ Workspace oprettes succesfuldt
- ✅ Sandbox markeres som "running" i database
- ❌ Preview URL returnerer HTTP 400
- ❌ Preview viser "Starting dev server..." indefinitely
- ❌ Ingen Next.js dev server kører i E2B sandbox

### Forventet Adfærd
1. Workspace oprettes
2. E2B sandbox startes
3. Next.js template bootstrappes
4. Dependencies installeres (`npm install`)
5. Dev server startes (`npm run dev`)
6. Health check passerer
7. Preview vises i iframe

### Faktisk Adfærd
1. ✅ Workspace oprettes
2. ✅ E2B sandbox startes
3. ❌ Bootstrap kører IKKE
4. ❌ Dev server startes ALDRIG
5. ❌ Preview URL returnerer 400

---

## 2. Debugging Proces & Fund

### 2.1 Initial Diagnose

**Hypotese 1:** Sandbox termination under `npm run dev`

**Test:**
```javascript
// Kørte test i E2B sandbox
await sandbox.commands.run('npm run dev -- --port 3000');
// Result: Sandbox terminerede efter ~30 sekunder
```

**Konklusion:** ✅ Bekræftet - E2B terminerer sandboxen når long-running process køres uden proper background handling.

---

### 2.2 Fix #1: Database Trigger

**Problem:** Database trigger fejlede med "Invalid state transition from running to running"

**Root Cause:**
```sql
-- Gammel trigger
IF NEW.status = OLD.status THEN
  RAISE EXCEPTION 'Invalid state transition from % to %', OLD.status, NEW.status;
END IF;
```

**Fix:** Tillad field updates uden status change
```sql
-- Ny trigger (migration 0009)
IF NEW.status = OLD.status AND 
   row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
  -- Allow field updates
  RETURN NEW;
END IF;
```

**Status:** ✅ Deployed til Supabase  
**Fil:** `supabase/migrations/0009_fix_sandbox_state_trigger.sql`

---

### 2.3 Fix #2: Preview URL Normalisering

**Problem:** CSP fejl pga. `:3000` i preview URL

**Root Cause:**
```typescript
// Gammel kode
const url = `https://${sandboxId}.e2b.dev:3000`;
// CSP blokkerer pga. explicit port
```

**Fix:** Central normalisering funktion
```typescript
// lib/sandbox/preview-url.ts
export function normalizePreviewUrl(url: string): string {
  return url.replace(/:3000$/, '').replace(/:3000\//, '/');
}
```

**Status:** ✅ Implementeret i alle relevante filer  
**Filer:**
- `lib/sandbox/preview-url.ts` (NY)
- `app/api/sandboxes/create/route.ts`
- `lib/sandbox/use-sandbox-lifecycle.ts`

---

### 2.4 Fix #3: Health Check Timeout

**Problem:** For kort wait time før health check

**Root Cause:**
```typescript
// Gammel kode
await new Promise(resolve => setTimeout(resolve, 5000)); // 5s
const healthResult = await waitForPreviewReady(url, {
  maxAttempts: 30, // 1 minut total
});
```

**Fix:** Længere initial wait og flere attempts
```typescript
// Ny kode
await new Promise(resolve => setTimeout(resolve, 10000)); // 10s
const healthResult = await waitForPreviewReady(url, {
  maxAttempts: 120, // 4 minutter total
  intervalMs: 2000,
});
```

**Status:** ✅ Implementeret  
**Fil:** `lib/sandbox/e2b-manager.ts`

---

### 2.5 Fix #4: Background Process Execution

**Problem:** E2B terminerer sandbox når `npm run dev` køres

**Root Cause:**
```typescript
// Gammel kode - blocker indtil process terminerer
const devServerPromise = sandbox.commands.run('npm run dev');
await devServerPromise; // Blocker forever eller timeout
```

**Fix:** Brug `nohup` og `&` til background execution
```typescript
// Ny kode
await sandbox.commands.run(
  `nohup npm run dev -- --port ${port} --hostname 0.0.0.0 > /tmp/dev-server.log 2>&1 &`,
  { timeoutMs: 5000 }
);
```

**Status:** ✅ Implementeret  
**Fil:** `lib/sandbox/e2b-manager.ts`

---

### 2.6 Fix #5: Bootstrap Function Mismatch

**Problem:** API kaldte forkert bootstrap funktion

**Root Cause:**
```typescript
// app/api/sandboxes/create/route.ts
// Gammel kode - brugte AI bootstrap
const bootstrapResult = await bootstrapWorkspace(
  e2bSandbox.id,
  workspace.name
);
```

**Fix:** Brug E2BManager.startDevServer med template bootstrap
```typescript
// Ny kode
await E2BManager.startDevServer(e2bSandbox.id, 3000, (progress) => {
  console.log(`[Sandbox Create] Progress: ${progress.status}`);
});
```

**Status:** ✅ Implementeret  
**Fil:** `app/api/sandboxes/create/route.ts`

---

### 2.7 Fix #6: Frontend Idempotency Check

**Problem:** Frontend reconnectede til gamle sandboxes

**Root Cause:**
```typescript
// lib/sandbox/use-sandbox-lifecycle.ts
useEffect(() => {
  checkExistingSandbox(); // Kørte automatisk ved mount
}, []);
```

**Fix:** Disable frontend check - lad API håndtere idempotency
```typescript
useEffect(() => {
  // checkExistingSandbox(); // DISABLED
}, []);
```

**Status:** ✅ Implementeret  
**Fil:** `lib/sandbox/use-sandbox-lifecycle.ts`

---

## 3. Nuværende Problem

### 3.1 API Idempotency Check

**Problem:** API reconnectes til eksisterende sandboxes i stedet for at køre bootstrap

**Observeret Adfærd:**
```
[API] Step 5: Checking for existing sandboxes...
[API] ✓ Existing sandboxes check complete: 1 found
[Sandbox Create] Found existing sandbox: 49e81715-e3a3-4b0b-be98-aa53a6b842e9
[Sandbox Create] Attempting to reconnect to sandbox isrpb6hwnu8it1e4rv2gv...
[Sandbox Create] ✓ Successfully reconnected to existing sandbox
```

**Root Cause:**
```typescript
// app/api/sandboxes/create/route.ts
const { data: existingSandboxes } = await supabase
  .from('sandbox_instances')
  .select('id, status, container_id')
  .eq('workspace_id', workspaceId)
  .in('status', ['creating', 'starting', 'running']);

if (existingSandboxes && existingSandboxes.length > 0) {
  // Reconnect - SKIPS BOOTSTRAP!
  return NextResponse.json({ reconnected: true });
}
```

**Konsekvens:**
- Bootstrap kører ALDRIG
- Dev server startes ALDRIG
- Preview URL returnerer 400

---

### 3.2 Cleanup Forsøg

**Forsøg 1:** Sæt sandboxes til `stopping`
```sql
UPDATE sandbox_instances SET status = 'stopping';
```
**Resultat:** ❌ API finder stadig sandboxes (status IN ['creating', 'starting', 'running'])

**Forsøg 2:** DELETE alle sandboxes
```sql
DELETE FROM sandbox_instances;
```
**Resultat:** ❌ Nye sandboxes oprettes med samme problem

---

## 4. Arkitektur Analyse

### 4.1 Bootstrap Flow (Forventet)

```
1. Frontend: startSandbox()
   ↓
2. API: POST /api/sandboxes/create
   ↓
3. Check for existing sandbox
   ↓ (none found)
4. Create E2B sandbox
   ↓
5. E2BManager.startDevServer()
   ↓
6. Bootstrap workspace
   - Generate template files
   - Validate structure
   ↓
7. npm install
   ↓
8. npm run dev (background)
   ↓
9. Health check
   ↓
10. Mark as running + preview_ready
```

### 4.2 Faktisk Flow

```
1. Frontend: startSandbox()
   ↓
2. API: POST /api/sandboxes/create
   ↓
3. Check for existing sandbox
   ↓ (FOUND!)
4. Reconnect to existing
   ↓
5. Return { reconnected: true }
   ↓
6. Frontend polls status
   ↓
7. Status: running (men ingen dev server)
   ↓
8. Preview URL: 400 error
```

---

## 5. Mulige Løsninger

### Option A: Fjern API Idempotency Check

**Fordele:**
- Simpelt
- Garanterer bootstrap kører

**Ulemper:**
- Kan skabe duplicate sandboxes
- Ingen reconnect til eksisterende

**Implementation:**
```typescript
// Fjern eller kommenter ud
// if (existingSandboxes && existingSandboxes.length > 0) { ... }
```

---

### Option B: Forbedret Idempotency Check

**Fordele:**
- Reconnect til healthy sandboxes
- Opret ny hvis unhealthy

**Ulemper:**
- Mere kompleks logik

**Implementation:**
```typescript
if (existingSandboxes && existingSandboxes.length > 0) {
  const sandbox = existingSandboxes[0];
  
  // Kun reconnect hvis preview er ready
  if (sandbox.status === 'running' && sandbox.preview_ready) {
    return reconnect(sandbox);
  }
  
  // Ellers mark som terminated og opret ny
  await markTerminated(sandbox.id);
  // Continue to create new...
}
```

---

### Option C: Brug E2B's Next.js Template

**Fordele:**
- Pre-configured Next.js setup
- Garanteret valid struktur
- Hurtigere bootstrap

**Ulemper:**
- Mindre kontrol over template
- Skal tilpasse til COCO's behov

**Implementation:**
```typescript
const sandbox = await Sandbox.create('nextjs', {
  apiKey,
  metadata: { workspaceId }
});
```

---

## 6. Teknisk Gæld

### 6.1 Manglende Logging

**Problem:** Bootstrap logs er server-side, ikke synlige i browser console

**Løsning:** Implementer SSE (Server-Sent Events) for real-time progress

---

### 6.2 State Machine Kompleksitet

**Problem:** Database trigger og status transitions er komplekse

**Løsning:** Simplificer state machine eller dokumenter bedre

---

### 6.3 Idempotency vs. Freshness

**Problem:** Balance mellem at genbruge sandboxes og sikre fresh bootstrap

**Løsning:** Definer klar policy for hvornår der reconnectes vs. oprettes ny

---

## 7. Test Plan

### 7.1 Manual Test

1. Kør cleanup SQL
2. Opret ny workspace
3. Observer logs:
   - Browser console
   - Server logs (`preview_get_log`)
4. Verificer:
   - Bootstrap kører
   - Dev server starter
   - Preview vises

### 7.2 Automated Test

```typescript
describe('Sandbox Bootstrap', () => {
  it('should bootstrap new workspace', async () => {
    const workspace = await createWorkspace();
    const sandbox = await createSandbox(workspace.id);
    
    expect(sandbox.status).toBe('running');
    expect(sandbox.preview_ready).toBe(true);
    
    const response = await fetch(sandbox.preview_url);
    expect(response.status).toBe(200);
  });
});
```

---

## 8. Anbefalinger

### Kort Sigt (Akut Fix)

1. **Implementer Option B** - Forbedret idempotency check
2. **Tilføj mere logging** - Gør det nemmere at debugge
3. **Test grundigt** - Verificer at bootstrap kører

### Mellem Sigt

1. **Implementer SSE** - Real-time progress til frontend
2. **Forbedre error handling** - Bedre fejlbeskeder
3. **Dokumenter state machine** - Klar dokumentation af transitions

### Lang Sigt

1. **Overvej E2B Next.js template** - Simplificer bootstrap
2. **Implementer monitoring** - Proaktiv fejldetektion
3. **Automatiserede tests** - Forebyg regressioner

---

## 9. Filer Modificeret

### Migrations
- `supabase/migrations/0009_fix_sandbox_state_trigger.sql` ✅

### Core Logic
- `lib/sandbox/e2b-manager.ts` ✅
- `lib/sandbox/preview-url.ts` ✅ (NY)
- `lib/sandbox/use-sandbox-lifecycle.ts` ✅
- `app/api/sandboxes/create/route.ts` ✅

### Documentation
- `DATABASE-TRIGGER-FIX.md` ✅
- `CLEANUP-AND-TEST-GUIDE.md` ✅
- `AGGRESSIVE-CLEANUP.sql` ✅
- `SANDBOX-DEBUG-RAPPORT.md` ✅ (DENNE FIL)

---

## 10. Næste Skridt

### Umiddelbart

1. ✅ Dokumenter alle fund (denne fil)
2. ⏳ Implementer Option B (forbedret idempotency)
3. ⏳ Test grundigt
4. ⏳ Verificer preview virker

### Opfølgning

1. ⏳ Tilføj SSE for progress tracking
2. ⏳ Implementer automated tests
3. ⏳ Dokumenter arkitektur bedre
4. ⏳ Overvej E2B Next.js template

---

## 11. Kontakt & Support

**Developer:** Henosia AI Assistant  
**Project:** COCO - AI Coding Platform  
**Repository:** nextjs-shadcn-blank1  
**Last Updated:** 6. april 2026, 13:50 UTC

---

## Appendix A: Relevante Logs

### Successful API Call (men ingen bootstrap)
```
[API] POST /api/sandboxes/create called
[API] ✓ User authenticated: 7c0d1644-6080-4e03-bd82-e60a323d64af
[API] ✓ Workspace verified: f948bbae-eda7-4520-a9d2-c1041a58e3c0
[API] ✓ Existing sandboxes check complete: 1 found
[Sandbox Create] Found existing sandbox: 49e81715-e3a3-4b0b-be98-aa53a6b842e9
[Sandbox Create] ✓ Successfully reconnected to existing sandbox
```

### Expected Logs (ikke observeret)
```
[E2B] Step 1/4: Bootstrapping workspace...
[E2B] ✓ Step 1/4: Workspace bootstrapped and validated
[E2B] Step 2/4: Installing dependencies...
[E2B] ✓ Step 2/4: Dependencies installed successfully
[E2B] Step 3/4: Starting dev server...
[E2B] ✓ Dev server started in background
[E2B] Step 4/4: Waiting for health check...
[E2B] ✓ Step 4/4: Health check passed!
```

---

## Appendix B: Database Schema

### sandbox_instances
```sql
CREATE TABLE sandbox_instances (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  container_id TEXT,
  status TEXT CHECK (status IN ('creating', 'starting', 'running', 'stopping', 'stopped', 'failed', 'terminated')),
  preview_ready BOOLEAN DEFAULT FALSE,
  port INTEGER,
  error_message TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### workspaces
```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  sandbox_id UUID REFERENCES sandbox_instances(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

**END OF REPORT**
