/**
 * Sandbox Reconciliation Service
 * 
 * Reconciles database sandbox state with actual E2B sandbox state
 * Cleans up stale references and ensures consistency
 */

import { createClient } from '@/lib/supabase/server';
import { Sandbox } from 'e2b';

interface ReconciliationResult {
  checked: number;
  terminated: number;
  cleared: number;
  errors: string[];
}

/**
 * Reconcile all sandboxes in database with E2B
 * Marks stale sandboxes as terminated and clears workspace references
 */
export async function reconcileSandboxes(): Promise<ReconciliationResult> {
  console.log('[Reconciliation] Starting sandbox reconciliation...');
  
  const result: ReconciliationResult = {
    checked: 0,
    terminated: 0,
    cleared: 0,
    errors: [],
  };

  try {
    const supabase = await createClient();
    const apiKey = process.env.E2B_API_KEY;

    if (!apiKey) {
      throw new Error('E2B_API_KEY not configured');
    }

    // Find all potentially active sandboxes
    const { data: sandboxes, error: fetchError } = await supabase
      .from('sandbox_instances')
      .select('*')
      .in('status', ['creating', 'starting', 'running', 'paused']);

    if (fetchError) {
      console.error('[Reconciliation] Error fetching sandboxes:', fetchError);
      result.errors.push(`Fetch error: ${fetchError.message}`);
      return result;
    }

    if (!sandboxes || sandboxes.length === 0) {
      console.log('[Reconciliation] No active sandboxes to reconcile');
      return result;
    }

    console.log(`[Reconciliation] Found ${sandboxes.length} potentially active sandboxes`);

    // Check each sandbox against E2B
    for (const sandbox of sandboxes) {
      result.checked++;
      
      console.log(`[Reconciliation] Checking sandbox ${sandbox.id} (container: ${sandbox.container_id})`);

      if (!sandbox.container_id) {
        // No container ID means it never got created in E2B
        console.log(`[Reconciliation] Sandbox ${sandbox.id} has no container_id, marking as terminated`);
        
        await markSandboxTerminated(supabase, sandbox.id, 'No container ID - never created in E2B');
        result.terminated++;
        
        // Clear workspace reference
        if (sandbox.workspace_id) {
          await clearWorkspaceSandbox(supabase, sandbox.workspace_id, sandbox.id);
          result.cleared++;
        }
        
        continue;
      }

      // Try to connect to sandbox in E2B
      let isAlive = false;
      try {
        const e2bSandbox = await Sandbox.connect(sandbox.container_id, {
          apiKey,
          timeoutMs: 5000, // Short timeout for reconciliation
        });
        
        // If we can connect, it's alive
        isAlive = true;
        console.log(`[Reconciliation] Sandbox ${sandbox.id} is alive in E2B`);
        
      } catch (error) {
        // Connection failed - sandbox doesn't exist or is terminated
        console.log(`[Reconciliation] Sandbox ${sandbox.id} not found in E2B:`, error instanceof Error ? error.message : 'Unknown error');
        isAlive = false;
      }

      // If not alive, mark as terminated
      if (!isAlive) {
        console.log(`[Reconciliation] Marking sandbox ${sandbox.id} as terminated`);
        
        await markSandboxTerminated(
          supabase,
          sandbox.id,
          'Sandbox not found in E2B - likely timed out or terminated'
        );
        result.terminated++;

        // Clear workspace reference
        if (sandbox.workspace_id) {
          await clearWorkspaceSandbox(supabase, sandbox.workspace_id, sandbox.id);
          result.cleared++;
        }
      }
    }

    console.log('[Reconciliation] Reconciliation complete:', result);
    return result;

  } catch (error) {
    console.error('[Reconciliation] Fatal error:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

/**
 * Mark a sandbox as terminated in database
 */
async function markSandboxTerminated(
  supabase: any,
  sandboxId: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  
  const { error } = await supabase
    .from('sandbox_instances')
    .update({
      status: 'terminated',
      error_message: reason,
      updated_at: now,
      last_seen_at: now,
    })
    .eq('id', sandboxId);

  if (error) {
    console.error(`[Reconciliation] Error marking sandbox ${sandboxId} as terminated:`, error);
    throw error;
  }

  console.log(`[Reconciliation] ✓ Marked sandbox ${sandboxId} as terminated`);
}

/**
 * Clear workspace sandbox reference
 */
async function clearWorkspaceSandbox(
  supabase: any,
  workspaceId: string,
  sandboxId: string
): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .update({
      sandbox_id: null,
    })
    .eq('id', workspaceId)
    .eq('sandbox_id', sandboxId); // Only clear if it still points to this sandbox

  if (error) {
    console.error(`[Reconciliation] Error clearing workspace ${workspaceId} sandbox reference:`, error);
    throw error;
  }

  console.log(`[Reconciliation] ✓ Cleared workspace ${workspaceId} sandbox reference`);
}

/**
 * Reconcile a specific sandbox
 * Used during workspace creation to auto-cleanup stale references
 */
export async function reconcileSandbox(sandboxId: string): Promise<boolean> {
  console.log(`[Reconciliation] Reconciling single sandbox ${sandboxId}...`);

  try {
    const supabase = await createClient();
    const apiKey = process.env.E2B_API_KEY;

    if (!apiKey) {
      throw new Error('E2B_API_KEY not configured');
    }

    // Get sandbox from database
    const { data: sandbox, error: fetchError } = await supabase
      .from('sandbox_instances')
      .select('*')
      .eq('id', sandboxId)
      .single();

    if (fetchError || !sandbox) {
      console.log(`[Reconciliation] Sandbox ${sandboxId} not found in database`);
      return false;
    }

    if (!sandbox.container_id) {
      console.log(`[Reconciliation] Sandbox ${sandboxId} has no container_id`);
      await markSandboxTerminated(supabase, sandboxId, 'No container ID');
      if (sandbox.workspace_id) {
        await clearWorkspaceSandbox(supabase, sandbox.workspace_id, sandboxId);
      }
      return false;
    }

    // Try to connect to E2B
    try {
      await Sandbox.connect(sandbox.container_id, {
        apiKey,
        timeoutMs: 5000,
      });
      
      console.log(`[Reconciliation] Sandbox ${sandboxId} is alive`);
      return true;
      
    } catch (error) {
      console.log(`[Reconciliation] Sandbox ${sandboxId} not found in E2B`);
      await markSandboxTerminated(supabase, sandboxId, 'Not found in E2B');
      if (sandbox.workspace_id) {
        await clearWorkspaceSandbox(supabase, sandbox.workspace_id, sandboxId);
      }
      return false;
    }

  } catch (error) {
    console.error(`[Reconciliation] Error reconciling sandbox ${sandboxId}:`, error);
    return false;
  }
}
