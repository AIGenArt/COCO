# COCO Project Status - 2026-04-06 01:14 UTC

## ✅ Fixes Implementeret

### 1. Database Trigger Fix
**Problem:** Trigger blokerede field updates når status var 'running'  
**Løsning:** Tilføjet `NEW.status != OLD.status` check  
**Status:** ✅ DEPLOYED (migration kørt i Supabase)

### 2. Preview URL Normalisering
**Problem:** CSP fejl pga. `:3000` i URL  
**Løsning:** Central `normalizePreviewUrl()` funktion  
**Status:** ✅ IMPLEMENTERET

**Filer opdateret:**
- `lib/sandbox/preview-url.ts` - Central normalizer (NY)
- `lib/sandbox/e2b-manager.ts` - Health check normalisering
- `app/api/sandboxes/create/route.ts` - API response normalisering
- `lib/sandbox/use-sandbox-lifecycle.ts` - Frontend normalisering

**Resultat:**
```
✅ Ingen CSP fejl
✅ URL uden :3000
✅ Normalisering virker korrekt
```

## ⚠️ Nyt Problem: Dev Server Crash

### Symptomer
```
[E2B] ✗ Dev server process error: SandboxError: 2: [unknown] terminated
```

Preview URL returnerer 400:
```
iy33vunwhfhywc3sycy6z.e2b.dev/:1 Failed to load resource: 400
```

### Root Cause
Sandboxen markeres som "running" og "preview ready" **før** dev serveren er fuldt startet.

### Flow Problem

**Nuværende flow:**
1. Bootstrap workspace ✅
2. Install dependencies ✅
3. Start dev server (background) ✅
4. Wait 5 seconds ⚠️
5. Health check ⚠️
6. Mark as running ✅
7. Mark preview ready ✅

**Problem:** 
- Health check kører for tidligt
- Dev server ikke fuldt startet
- Sandbox termineres

### Løsning Påkrævet

Vi skal enten:

**Option A: Øg wait time**
- Vent længere før health check (10-15 sek)
- Simpel men ikke robust

**Option B: Bedre health check**
- Poll indtil dev server svarer 200
- Mere robust
- Allerede implementeret i `preview-health.ts`

**Option C: Fjern "preview ready" koncept**
- Lad frontend selv tjekke om preview er klar
- Sandbox er "running" når dev server starter
- Preview er klar når den svarer

## Anbefaling

**Implementer Option B:**

1. Øg `maxAttempts` i health check til 120 (4 minutter)
2. Øg initial wait til 10 sekunder
3. Lad health check køre længere før timeout

Dette er allerede delvist implementeret - vi skal bare justere timeouts.

## Næste Skridt

1. Juster health check timeouts i `e2b-manager.ts`
2. Test workspace creation igen
3. Verificer at dev server når at starte

---

**Prioritet:** HIGH  
**Impact:** Blokerer workspace preview  
**Estimated Fix Time:** 5 minutter
