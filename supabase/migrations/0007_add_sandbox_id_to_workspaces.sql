-- Add sandbox_id column to workspaces table
-- This links a workspace to its active e2b sandbox
-- Using TEXT type since e2b uses string IDs, not UUIDs

ALTER TABLE workspaces
ADD COLUMN sandbox_id TEXT;

-- Add index for faster lookups
CREATE INDEX idx_workspaces_sandbox_id ON workspaces(sandbox_id);

-- Add comment
COMMENT ON COLUMN workspaces.sandbox_id IS 'Reference to the active e2b sandbox instance (e2b string ID)';
