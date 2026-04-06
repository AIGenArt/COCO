-- AGGRESSIVE CLEANUP - DELETE ALL SANDBOXES
-- Run this in Supabase SQL Editor

BEGIN;

-- Delete all sandbox instances
DELETE FROM public.sandbox_instances;

-- Clear all workspace sandbox references
UPDATE public.workspaces
SET sandbox_id = NULL;

COMMIT;

-- Verify cleanup
SELECT 'Sandboxes remaining:' as check, COUNT(*)::int as count
FROM public.sandbox_instances;

SELECT 'Workspaces with sandbox_id:' as check, COUNT(*)::int as count
FROM public.workspaces
WHERE sandbox_id IS NOT NULL;
