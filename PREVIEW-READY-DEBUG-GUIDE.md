# Preview Ready Debug Guide

## Formål
Verificere hvor `preview_ready` flow bryder ved at følge data gennem hele stacken.

---

## Test Procedure

### 1. Opret Ny Workspace
1. Gå til `/dashboard`
2. Klik "New Workspace"
3. Indtast navn (fx "test debug")
4. Klik "Create"

### 2. Observer Server Logs
Kig efter disse specifikke log entries:

#### A) Bootstrap Completion
```
[E2B] ✓ Step 4/4: Health check passed - preview is ready!
[Sandbox Create] ✓ Dev server started and health check passed!
```

#### B) markPreviewReady() Call (NY LOGGING)
```
[Preview Ready] ========================================
[Preview Ready] markPreviewReady called for sandbox: <id>
[Preview Ready] Current sandbox status: running
[Preview Ready] Updating database...
[Preview Ready] ✓ Database updated successfully
[Preview Ready] Updated sandbox: { preview_ready: true }
[Preview Ready] ========================================
```

**KRITISK:** Hvis du IKKE ser `[Preview Ready]` logs, betyder det at `markPreviewReady()` ALDRIG kaldes!

### 3. Observer Browser Console
Kig efter disse log entries:

#### A) Frontend Polling (NY LOGGING)
```
[Frontend Polling] Received sandbox state: {
  id: "...",
  status: "running",
  preview_ready: false,  // ← Hvad er værdien?
  container_id: "...",
  port: 3000
}
```

**KRITISK:** Tjek om `preview_ready` er `true` eller `false`

#### B) Polling Stop Condition
```
Sandbox <id> reached stable state: running, preview_ready: true
```

Hvis du ser `preview_ready: false` i stedet, fortsætter polling indefinitely.

---

## Forventede Scenarier

### Scenario A: markPreviewReady() Kaldes Aldrig ❌
**Server logs viser:**
```
[Sandbox Create] ✓ Dev server started and health check passed!
[Sandbox Create] Marking sandbox as running...
(INGEN [Preview Ready] logs)
```

**Root cause:** `markPreviewReady()` kaldes ikke i API route

**Fix:** Tilføj call i `app/api/sandboxes/create/route.ts`

---

### Scenario B: Database Update Fejler ❌
**Server logs viser:**
```
[Preview Ready] markPreviewReady called for sandbox: <id>
[Preview Ready] ✗ Database update failed: <error>
```

**Root cause:** Supabase permission eller constraint fejl

**Fix:** Tjek RLS policies og database constraints

---

### Scenario C: API Returnerer Ikke preview_ready ❌
**Server logs viser:**
```
[Preview Ready] ✓ Database updated successfully
[Preview Ready] Updated sandbox: { preview_ready: true }
```

**Browser console viser:**
```
[Frontend Polling] Received sandbox state: {
  status: "running",
  preview_ready: false  // ← FORKERT!
}
```

**Root cause:** `/api/sandboxes/[id]` route returnerer ikke feltet

**Fix:** Verificer API response inkluderer `preview_ready`

---

### Scenario D: Frontend Ignorerer preview_ready ❌
**Browser console viser:**
```
[Frontend Polling] Received sandbox state: {
  status: "running",
  preview_ready: true  // ← KORREKT!
}
```

Men UI viser stadig "Starting dev server..."

**Root cause:** Frontend condition checker ikke `preview_ready`

**Fix:** Verificer UI gating condition

---

## Hvad Skal Rapporteres

### 1. Server Logs
Kopier ALLE logs fra:
- `[E2B]` entries
- `[Sandbox Create]` entries  
- `[Preview Ready]` entries (hvis nogen)

### 2. Browser Console Logs
Kopier ALLE logs fra:
- `[Frontend Polling]` entries
- `Sandbox ... reached stable state` entries

### 3. Database State (Valgfrit)
Hvis muligt, kør denne SQL i Supabase:
```sql
SELECT 
  id, 
  status, 
  preview_ready, 
  container_id, 
  port,
  created_at,
  updated_at
FROM sandbox_instances
WHERE workspace_id = '<workspace-id>'
ORDER BY created_at DESC
LIMIT 1;
```

### 4. API Response (Valgfrit)
Åbn Network tab i browser DevTools og find:
```
GET /api/sandboxes/<id>
```

Kopier response body.

---

## Quick Diagnosis

| Server Logs | Browser Logs | Diagnosis |
|-------------|--------------|-----------|
| ❌ No [Preview Ready] | ❌ preview_ready: false | markPreviewReady() not called |
| ✅ [Preview Ready] ✓ | ❌ preview_ready: false | API not returning field |
| ✅ [Preview Ready] ✓ | ✅ preview_ready: true | Frontend UI issue |
| ❌ [Preview Ready] ✗ | ❌ preview_ready: false | Database update failed |

---

## Næste Skridt Efter Test

Baseret på resultaterne, vil vi implementere den korrekte fix:

1. **Scenario A:** Tilføj `markPreviewReady()` call
2. **Scenario B:** Fix database permissions
3. **Scenario C:** Fix API response
4. **Scenario D:** Fix frontend UI condition

---

**Klar til test!** Opret workspace og rapporter tilbage med logs.
