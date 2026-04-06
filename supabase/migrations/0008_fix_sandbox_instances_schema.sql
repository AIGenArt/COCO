-- ============================================================================
-- Fix sandbox_instances Schema
-- Add missing columns and auto-update trigger
-- Version: 1.0.0
-- Created: 2026-03-29
-- ============================================================================

-- Add missing columns to sandbox_instances
ALTER TABLE sandbox_instances
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS preview_ready BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS container_id TEXT,
ADD COLUMN IF NOT EXISTS port INTEGER;

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on any UPDATE
CREATE TRIGGER update_sandbox_instances_updated_at
  BEFORE UPDATE ON sandbox_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sandbox_instances_preview_ready 
ON sandbox_instances(preview_ready);

CREATE INDEX IF NOT EXISTS idx_sandbox_instances_container_id 
ON sandbox_instances(container_id) WHERE container_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sandbox_instances_port 
ON sandbox_instances(port) WHERE port IS NOT NULL;

-- Add comments
COMMENT ON COLUMN sandbox_instances.updated_at IS 'Automatically updated on any change';
COMMENT ON COLUMN sandbox_instances.preview_ready IS 'Indicates if the sandbox preview is ready to be displayed';
COMMENT ON COLUMN sandbox_instances.error_message IS 'Error message if sandbox failed';
COMMENT ON COLUMN sandbox_instances.container_id IS 'E2B container/sandbox ID';
COMMENT ON COLUMN sandbox_instances.port IS 'Port where dev server runs';
