-- ============================================================================
-- COCO Sandbox Events Table
-- Event logging for sandbox operations
-- Version: 1.0.0
-- Created: 2026-03-21
-- ============================================================================

-- Create sandbox_events table
CREATE TABLE sandbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sandbox_id UUID REFERENCES sandbox_instances(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  
  -- Metadata (flexible JSON for additional context)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance (especially for RLS policies and queries)
CREATE INDEX idx_sandbox_events_workspace_id ON sandbox_events(workspace_id);
CREATE INDEX idx_sandbox_events_sandbox_id ON sandbox_events(sandbox_id);
CREATE INDEX idx_sandbox_events_created_at ON sandbox_events(created_at DESC);
CREATE INDEX idx_sandbox_events_severity ON sandbox_events(severity);
CREATE INDEX idx_sandbox_events_event_type ON sandbox_events(event_type);

-- Enable RLS
ALTER TABLE sandbox_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only READ their own events
-- No INSERT policy for users - only runtime service writes (with secret key)
CREATE POLICY "Users can view events for own workspaces"
  ON sandbox_events FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

-- Grant SELECT to authenticated users (for reading)
GRANT SELECT ON sandbox_events TO authenticated;

-- NOTE: No INSERT/UPDATE/DELETE grants for authenticated users
-- Runtime service uses secret key which bypasses RLS and has full access

-- View for recent critical events (useful for monitoring)
CREATE VIEW recent_critical_events AS
SELECT 
  e.id,
  e.workspace_id,
  e.sandbox_id,
  e.event_type,
  e.message,
  e.metadata,
  e.created_at,
  w.name as workspace_name,
  w.user_id
FROM sandbox_events e
JOIN workspaces w ON e.workspace_id = w.id
WHERE e.severity = 'critical'
  AND e.created_at > NOW() - INTERVAL '24 hours'
ORDER BY e.created_at DESC;

-- Grant access to view
GRANT SELECT ON recent_critical_events TO authenticated;

-- Comments for documentation
COMMENT ON TABLE sandbox_events IS 'Event log for sandbox operations - users can only read their own events';
COMMENT ON COLUMN sandbox_events.severity IS 'Event severity: info, warning, error, or critical';
COMMENT ON COLUMN sandbox_events.metadata IS 'Flexible JSON for additional event context';

-- Important security note
COMMENT ON TABLE sandbox_events IS 'SECURITY: No user INSERT policy - only runtime service (with secret key) can write events. This ensures event log integrity.';
