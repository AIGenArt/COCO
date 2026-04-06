-- ============================================================================
-- Fix Sandbox State Machine Trigger
-- Allow field updates without status changes
-- Version: 1.0.0
-- Created: 2026-04-06
-- ============================================================================

-- Drop and recreate the function with fixed logic
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

-- Comment for documentation
COMMENT ON FUNCTION enforce_sandbox_state_transitions() IS 'Enforces valid state machine transitions while allowing field updates when status does not change';
