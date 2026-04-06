# Database Trigger Fix - CRITICAL

## Problem

Database trigger `enforce_sandbox_state_transitions()` var for streng og tillod ikke opdatering af felter (som `preview_ready`, `last_seen_at`) når sandbox status var 'running'.

**Fejl:**
```
Failed to mark preview ready: Invalid state transition from running to running
```

## Root Cause

Trigger'en validerede ALLE opdateringer, selv når status ikke ændrede sig:

```sql
-- GAMMEL (FORKERT):
IF OLD.status = 'running' AND NEW.status NOT IN ('stopping', 'failed', 'destroying') THEN
  RAISE EXCEPTION 'Invalid state transition from running to %', NEW.status;
END IF;
```

Dette blokerede opdateringer som:
- `UPDATE sandbox_instances SET preview_ready = true WHERE id = '...'`
- `UPDATE sandbox_instances SET last_seen_at = NOW() WHERE id = '...'`

## Løsning

Opdateret trigger til kun at validere når status FAKTISK ændres:

```sql
-- NY (KORREKT):
IF OLD.status = 'running' AND NEW.status != OLD.status AND NEW.status NOT IN ('stopping', 'failed', 'destroying') THEN
  RAISE EXCEPTION 'Invalid state transition from running to %', NEW.status;
END IF;
```

## Hvordan man fikser det

### Option 1: Via Supabase Dashboard (ANBEFALET)

1. Gå til Supabase Dashboard: https://supabase.com/dashboard/project/vznkmrsxwnudpykbanxu/editor
2. Klik på "SQL Editor"
3. Kør denne SQL:

```sql
-- Fix Sandbox State Machine Trigger
-- Allow field updates without status changes

CREATE OR REPLACE FUNCTION enforce_sandbox_state_transitions()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changes to destroyed sandboxes
  IF OLD.status = 'destroyed' THEN
    RAISE EXCEPTION 'Cannot modify destroyed sandbox';
  END IF;
  
  -- Prevent invalid state transitions from running (allow same status for field updates)
  IF OLD.status = 'running' AND NEW.status != OLD.status AND NEW.status NOT IN ('stopping', 'failed', 'destroying') THEN
    RAISE EXCEPTION 'Invalid state transition from running to %', NEW.status;
  END IF;
  
  -- Validate specific transitions (only when status actually changes)
  IF OLD.status != NEW.status THEN
    IF OLD.status = 'creating' AND NEW.status NOT IN ('starting', 'failed', 'destroying') THEN
      RAISE EXCEPTION 'Can only transition from creating to starting, failed, or destroying';
    END IF;
    
    IF OLD.status = 'starting' AND NEW.status NOT IN ('running', 'failed', 'destroying') THEN
      RAISE EXCEPTION 'Can only transition from starting to running, failed, or destroying';
    END IF;
    
    IF OLD.status = 'stopping' AND NEW.status NOT IN ('stopped', 'failed', 'destroying') THEN
      RAISE EXCEPTION 'Can only transition from stopping to stopped, failed, or destroying';
    END IF;
    
    IF OLD.status = 'stopped' AND NEW.status NOT IN ('starting', 'destroying') THEN
      RAISE EXCEPTION 'Can only transition from stopped to starting or destroying';
    END IF;
    
    IF OLD.status = 'failed' AND NEW.status != 'destroying' THEN
      RAISE EXCEPTION 'Can only transition from failed to destroying';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

4. Klik "Run"
5. Verificer at det virker ved at oprette en ny workspace

### Option 2: Via Supabase CLI (hvis disk space tillader det)

```bash
npx supabase db push
```

## Verificering

Efter fix, test ved at:

1. Gå til `/dashboard`
2. Klik "New Workspace"
3. Vent på at workspace oprettes
4. Tjek at preview vises korrekt
5. Ingen "Invalid state transition" fejl i logs

## Filer Opdateret

- ✅ `supabase/migrations/0005_sandbox_instances.sql` - Opdateret original migration
- ✅ `supabase/migrations/0009_fix_sandbox_state_trigger.sql` - Ny migration med fix
- ✅ `DATABASE-TRIGGER-FIX.md` - Denne dokumentation

## Status

⚠️ **MIGRATION SKAL KØRES MANUELT**

Disk space problem forhindrer automatisk migration. Kør SQL direkte i Supabase Dashboard.

---

**Prioritet:** CRITICAL  
**Impact:** Blokerer alle workspace creations  
**Fix Time:** 2 minutter via dashboard
