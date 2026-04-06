# COCO Sandbox - Final Debug Status
**Dato:** 6. april 2026, 14:55 UTC  
**Status:** Bootstrap virker, men preview_ready sættes ikke korrekt

---

## ✅ Hvad Virker

### 1. Backend Bootstrap (KOMPLET)
- ✅ E2B sandbox oprettes
- ✅ Template files genereres
- ✅ npm install kører
- ✅ Dev server startes i background med nohup
- ✅ Health check passerer (200 OK)
- ✅ Status sættes til 'running'

**Bevis:**
```
[E2B] ✓ Step 4/4: Health check passed - preview is ready!
[Sandbox Create] ✓ Dev server started and health check passed!
POST /api/sandboxes/create 200 in 44255ms
```

### 2. Verified Idempotency (IMPLEMENTERET)
- ✅ 5-step verification før sandbox reuse
- ✅ Automatic cleanup af failed sandboxes
- ✅ Korrekt brug af 'failed' status (ikke 'terminated')

### 3. Frontend Polling (FIXET)
- ✅ Poller kontinuerligt når status = 'running'
- ✅ Tjekker for preview_ready = true
- ✅ Stopper først når begge conditions er opfyldt

---

## ❌ Hvad Fejler

### Problem: preview_ready Sættes Aldrig til True

**Symptomer:**
```
Sandbox status changed: running (x20+)
Frontend poller hver 2. sekund
UI viser: "Starting dev server..." indefinitely
```

**Root Cause (Ubekræftet):**
En af disse 3 muligheder:

**A) `markPreviewReady()` kaldes aldrig**
```typescript
// I app/api/sandboxes/create/route.ts
await SandboxManager.transitionStatus(sandboxInstance.id, 'running');
await SandboxManager.markPreviewReady(sandboxInstance.id); // ← Kaldes dette?
```

**B) Database update fejler silent**
```typescript
// I lib/sandbox/sandbox-manager.ts
const { error } = await supabase
  .from('sandbox_instances')
  .update({ preview_ready: true })
  .eq('id', sandboxId);
// Hvis error - hvad sker der?
```

**C) Status API returnerer ikke preview_ready**
```typescript
// /api/sandboxes/[id]/status
// Returnerer den preview_ready field?
```

---

## 🔍 Verifikation Nødvendig

### 1. Server Logs
Tilføj eksplicit logging:
```typescript
console.log('[Preview Ready] markPreviewReady called for:', sandboxId);
console.log('[Preview Ready] DB update success:', !error);
console.log('[Preview Ready] Error if any:', error);
```

### 2. Database Check
```sql
SELECT id, status, preview_ready, container_id, port, updated_at
FROM sandbox_instances
WHERE id = '561b40ef-bac7-4d1a-93b5-2f6f17103d2d'
ORDER BY created_at DESC
LIMIT 1;
```

### 3. API Response
Tjek hvad `/api/sandboxes/[id]/status` faktisk returnerer:
```json
{
  "status": "running",
  "preview_ready": ???,  // true eller false?
  "preview_url": ???
}
```

### 4. Frontend State
Log hvad frontend modtager:
```typescript
console.log('[Frontend] Sandbox state:', {
  status: sandbox.status,
  preview_ready: sandbox.preview_ready,
  preview_url: sandbox.preview_url
});
```

---

## 🛠️ Anbefalede Fixes

### Fix 1: Atomisk Update (Foretrukket)
I stedet for to separate calls:
```typescript
// BEFORE (Race condition mulig)
await transitionStatus(id, 'running');
await markPreviewReady(id);

// AFTER (Atomisk)
await supabase
  .from('sandbox_instances')
  .update({
    status: 'running',
    preview_ready: true,
    preview_url: normalizedUrl,
    started_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  })
  .eq('id', sandboxId);
```

### Fix 2: Bedre Error Handling
```typescript
const { error } = await supabase
  .from('sandbox_instances')
  .update({ preview_ready: true })
  .eq('id', sandboxId);

if (error) {
  console.error('[Preview Ready] ✗ Failed to mark preview ready:', error);
  throw new Error(`Failed to mark preview ready: ${error.message}`);
}

console.log('[Preview Ready] ✓ Successfully marked preview ready');
```

### Fix 3: Stop Autosave Loop
Autosave triggers konstant fordi polling opdaterer metadata.

**Løsning:**
```typescript
// I workspace auto-save
// Ignorer opdateringer der kun ændrer last_seen_at eller updated_at
const hasRealChanges = (prev, next) => {
  const { last_seen_at: _, updated_at: __, ...prevData } = prev;
  const { last_seen_at: ___, updated_at: ____, ...nextData } = next;
  return JSON.stringify(prevData) !== JSON.stringify(nextData);
};
```

---

## 📊 Alle Implementerede Fixes

1. ✅ Database trigger fix (migration 0009)
2. ✅ Preview URL normalisering (fjern :3000)
3. ✅ Health check timeout (10s + 120 attempts)
4. ✅ Background process (nohup + &)
5. ✅ Bootstrap function fix (E2BManager.startDevServer)
6. ✅ Frontend idempotency disabled
7. ✅ Verified idempotency (5-step validation)
8. ✅ 'terminated' → 'failed' status fix
9. ✅ Frontend polling fix (tjek preview_ready)

---

## 🎯 Næste Skridt

### Umiddelbart (Kritisk)
1. **Verificer preview_ready flow**
   - Tilføj logging i markPreviewReady()
   - Tjek database direkte
   - Verificer API response

2. **Implementer atomisk update**
   - Kombiner status + preview_ready i én update
   - Eliminér race conditions

3. **Fix autosave loop**
   - Ignorer polling-opdateringer
   - Stop polling når preview_ready = true

### Opfølgning
1. Implementer SSE for real-time progress
2. Tilføj monitoring/metrics
3. Automated tests for bootstrap flow

---

## 📁 Modificerede Filer

### Core Logic
- `lib/sandbox/e2b-manager.ts` - Bootstrap + background process
- `lib/sandbox/sandbox-verification.ts` - 5-step verification (NY)
- `lib/sandbox/use-sandbox-status.ts` - Poll until preview_ready
- `lib/sandbox/preview-url.ts` - URL normalisering (NY)
- `app/api/sandboxes/create/route.ts` - Verified idempotency

### Database
- `supabase/migrations/0009_fix_sandbox_state_trigger.sql` - Trigger fix

### Documentation
- `SANDBOX-DEBUG-RAPPORT.md` - Komplet debug historie
- `VERIFIED-IDEMPOTENCY-IMPLEMENTATION.md` - Idempotency docs
- `FINAL-DEBUG-STATUS.md` - Denne fil

---

## 🏗️ Arkitektur (E2B + OpenRouter + Supabase)

```
Frontend (Next.js)
    ↓
Backend API Routes
    ├─ Supabase (auth + metadata + state)
    ├─ OpenRouter (AI inference)
    └─ E2B (sandbox runtime + preview)
```

**Klar rollefordeling:**
- **E2B:** Live workspace execution
- **OpenRouter:** AI model calls
- **Supabase:** Control plane + ownership

**Source of Truth:**
- E2B filesystem = live project state
- Supabase = metadata tracking
- (Future: GitHub = permanent source)

---

## 💡 Vigtig Indsigt

**Preview Ready Contract:**
```typescript
const isPreviewUsable =
  sandbox?.status === 'running' &&
  sandbox?.preview_ready === true &&
  !!sandbox?.preview_url;
```

Denne kontrakt skal komme fra backend **efter verificering mod E2B** - ikke bare fra DB-antagelser.

---

**Status:** 95% færdig - mangler kun preview_ready persistence  
**Estimeret tid til fix:** 15-30 minutter  
**Blocker:** Skal verificere hvor preview_ready flow bryder
