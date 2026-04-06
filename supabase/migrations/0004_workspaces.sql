-- ============================================================================
-- COCO Workspaces Table
-- Manages user workspaces with RLS
-- Version: 1.0.0
-- Created: 2026-03-21
-- ============================================================================

-- Create workspaces table
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Workspace details
  name TEXT NOT NULL,
  description TEXT,
  template TEXT NOT NULL DEFAULT 'nextjs',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_name CHECK (length(name) >= 1 AND length(name) <= 100),
  CONSTRAINT valid_template CHECK (template IN ('nextjs', 'react', 'vue', 'vanilla'))
);

-- Indexes for performance (especially for RLS policies)
CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX idx_workspaces_created_at ON workspaces(created_at DESC);
CREATE INDEX idx_workspaces_last_accessed ON workspaces(last_accessed_at DESC) WHERE last_accessed_at IS NOT NULL;

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own workspaces
CREATE POLICY "Users can view own workspaces"
  ON workspaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces"
  ON workspaces FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces"
  ON workspaces FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workspace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_updated_at();

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON workspaces TO authenticated;

-- Comments for documentation
COMMENT ON TABLE workspaces IS 'User workspaces with RLS - users can only access their own';
COMMENT ON COLUMN workspaces.user_id IS 'Owner of the workspace - used for RLS';
COMMENT ON COLUMN workspaces.template IS 'Project template: nextjs, react, vue, or vanilla';
COMMENT ON COLUMN workspaces.last_accessed_at IS 'Last time workspace was opened - used for cleanup';
