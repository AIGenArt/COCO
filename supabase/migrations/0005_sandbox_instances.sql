-- ============================================================================
-- COCO Sandbox Instances Table
-- Tracks runtime sandbox instances with state machine
-- Version: 1.0.0
-- Created: 2026-03-21
-- ============================================================================

-- Create sandbox_instances table
CREATE TABLE sandbox_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- State machine (enforced by CHECK constraint)
  status TEXT NOT NULL CHECK (status IN (
    'creating',   -- Container/process being created
    'starting',   -- Dev server starting
    'running',    -- Ready for use
    'stopping',   -- Graceful shutdown
    'stopped',    -- Cleanly stopped
    'failed',     -- Error state
    'destroying', -- Being deleted
    'destroyed'   -- Fully removed
  )),
  
  -- Runtime information
  process_id TEXT,              -- Process ID (for child process approach)
  preview_path TEXT,            -- Preview URL path
  dev_server_port INTEGER,      -- Port where dev server runs
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,     -- Last heartbeat
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_port CHECK (
    dev_server_port IS NULL OR 
    (dev_server_port >= 3000 AND dev_server_port <= 9999)
  ),
  CONSTRAINT valid_preview_path CHECK (
    preview_path IS NULL OR 
    preview_path ~ '^/api/preview/[a-zA-Z0-9_-]+/$'
  )
);

-- Indexes for performance (especially for RLS policies)
CREATE INDEX idx_sandbox_instances_workspace_id ON sandbox_instances(workspace_id);
CREATE INDEX idx_sandbox_instances_status ON sandbox_instances(status);
CREATE INDEX idx_sandbox_instances_last_seen ON sandbox_instances(last_seen_at DESC) WHERE last_seen_at IS NOT NULL;

-- Enable RLS
ALTER TABLE sandbox_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can access sandboxes for their own workspaces
CREATE POLICY "Users can view sandboxes for own workspaces"
  ON sandbox_instances FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sandboxes for own workspaces"
  ON sandbox_instances FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sandboxes for own workspaces"
  ON sandbox_instances FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sandboxes for own workspaces"
  ON sandbox_instances FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

-- Function to enforce state machine transitions
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

-- Trigger to enforce state machine
CREATE TRIGGER enforce_sandbox_state_machine
  BEFORE UPDATE ON sandbox_instances
  FOR EACH ROW
  EXECUTE FUNCTION enforce_sandbox_state_transitions();

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON sandbox_instances TO authenticated;

-- Comments for documentation
COMMENT ON TABLE sandbox_instances IS 'Sandbox runtime instances with state machine enforcement';
COMMENT ON COLUMN sandbox_instances.status IS 'State machine: creating → starting → running → stopping → stopped → destroying → destroyed';
COMMENT ON COLUMN sandbox_instances.process_id IS 'Process ID for child process approach (not Docker container ID)';
COMMENT ON COLUMN sandbox_instances.last_seen_at IS 'Last heartbeat - used for detecting dead sandboxes';
