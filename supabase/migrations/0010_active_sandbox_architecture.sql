-- Migration: Active Sandbox Architecture
-- Adds active_sandbox_id to workspaces and new sandbox statuses
-- Backward compatible - keeps existing sandbox_id temporarily

-- Step 1: Add new status values to sandbox_instances
ALTER TABLE sandbox_instances 
DROP CONSTRAINT IF EXISTS sandbox_instances_status_check;

ALTER TABLE sandbox_instances
ADD CONSTRAINT sandbox_instances_status_check
CHECK (status IN (
  'creating',
  'bootstrapping',
  'starting', 
  'running',
  'ready',
  'stopping',
  'terminated',
  'failed',
  'replaced'
));

-- Step 2: Add new columns to sandbox_instances
ALTER TABLE sandbox_instances
ADD COLUMN IF NOT EXISTS bootstrap_mode TEXT CHECK (bootstrap_mode IN ('template', 'repo')),
ADD COLUMN IF NOT EXISTS replaced_by_sandbox_id UUID REFERENCES sandbox_instances(id);

-- Step 3: Add active_sandbox_id to workspaces (backward compatible)
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS active_sandbox_id UUID;

-- Step 4: Migrate existing data (sandbox_id -> active_sandbox_id)
UPDATE workspaces
SET active_sandbox_id = sandbox_id
WHERE active_sandbox_id IS NULL
  AND sandbox_id IS NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE workspaces
ADD CONSTRAINT workspaces_active_sandbox_id_fkey
FOREIGN KEY (active_sandbox_id)
REFERENCES sandbox_instances(id)
ON DELETE SET NULL;

-- Step 6: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_active_sandbox_id 
ON workspaces(active_sandbox_id);

CREATE INDEX IF NOT EXISTS idx_sandbox_instances_replaced_by 
ON sandbox_instances(replaced_by_sandbox_id);

CREATE INDEX IF NOT EXISTS idx_sandbox_instances_status 
ON sandbox_instances(status);

-- Step 7: Add comment explaining the architecture
COMMENT ON COLUMN workspaces.active_sandbox_id IS 
'The ONLY sandbox that frontend should observe, poll, heartbeat, and preview. Single source of truth for active runtime.';

COMMENT ON COLUMN sandbox_instances.replaced_by_sandbox_id IS 
'If this sandbox was replaced, points to the new active sandbox that superseded it.';

-- Note: sandbox_id column will be dropped in a future migration after verification
-- For now, app code should read: active_sandbox_id ?? sandbox_id
