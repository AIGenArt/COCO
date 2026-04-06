# Cleanup and Test Guide

## Problem

Gamle sandboxes eksisterer stadig i databasen, så når vi opretter "ny" workspace reconnectes der bare til gammel sandbox uden at køre den nye bootstrap kode.

## Løsning: Cleanup Alle Sandboxes

### Option 1: Via Supabase Dashboard (Anbefalet)

1. Gå til Supabase Dashboard
2. Åbn SQL Editor
3. Kør denne query:

```sql
-- Mark all sandboxes as terminated
UPDATE sandbox_instances 
SET status = 'terminated', 
    error_message = 'Manual cleanup for testing'
WHERE status IN ('creating', 'starting', 'running');

-- Clear all workspace sandbox references
UPDATE workspaces 
SET sandbox_id = NULL;
```

### Option 2: Via Admin Cleanup Page

1. Gå til `/admin/cleanup` i COCO
2. Klik "Cleanup All Sandboxes"

## Efter Cleanup: Test Flow

1. **Gå til Dashboard**
   - URL: `/dashboard`

2. **Opret NY Workspace**
   - Klik "New Workspace"
   - Indtast navn: "Bootstrap Test"
   - Klik "Create"

3. **Åbn Browser Console**
   - F12 eller Right-click → Inspect
   - Gå til Console tab

4. **Vent og Observer**
   - Vent ~60-90 sekunder
   - Se efter disse logs:

```
[API] POST /api/sandboxes/create called
[API] Step 6: Creating new sandbox...
[Sandbox Create] Starting dev server with template bootstrap...
[E2B] Step 1/4: Bootstrapping workspace...
[E2B] ✓ Step 1/4: Workspace bootstrapped and validated
[E2B] Step 2/4: Installing dependencies...
[E2B] ✓ Step 2/4: Dependencies installed successfully
[E2B] Step 3/4: Starting dev server...
[E2B] ✓ Dev server started in background
[E2B] Step 4/4: Waiting for health check...
[E2B] Health check attempt 1: booting
[E2B] Health check attempt 2: booting
...
[E2B] ✓ Step 4/4: Health check passed - preview is ready!
```

5. **Forventet Resultat**
   - ✅ Preview vises med "Welcome to COCO"
   - ✅ Ingen 400 fejl
   - ✅ Ingen CSP fejl

## Hvis Det Stadig Fejler

Tjek server logs:
```bash
# I terminal eller via preview_get_log
# Se efter fejl under bootstrap
```

Mulige problemer:
- npm install fejler
- Dev server starter ikke
- Health check timeout

## Debugging Tips

### Se Server Logs
- Brug `preview_get_log` tool
- Eller tjek terminal hvor Next.js kører

### Se E2B Sandbox Logs
- Hvis vi har sandbox ID, kan vi SSH ind
- Tjek `/tmp/dev-server.log` for dev server output

### Verificer Template
- Tjek at `lib/sandbox/workspace-bootstrap.ts` har korrekt template
- Verificer at alle required files er i `generateMinimalTemplate()`

---

**Vigtigt:** Cleanup SKAL køres før test, ellers reconnectes der til gammel sandbox!
