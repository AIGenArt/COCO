/**
 * Lifecycle Service
 * 
 * Handles atomic sandbox replacement and lifecycle management.
 * Ensures workspace.active_sandbox_id is the single source of truth.
 */

import { createClient } from '@/lib/supabase/server';
import type { SandboxInstance } from './types';

/**
 * Replace sandbox parameters
 */
export interface ReplaceSandboxParams {
  workspaceId: string;
  newSandboxId: string;
  reason: string;
}

/**
 * Get active sandbox for workspace
 * 
 * Returns the sandbox referenced by workspace.active_sandbox_id
 * This is the ONLY sandbox that frontend should observe.
 */
export async function getActiveSandbox(
  workspaceId: string
): Promise<SandboxInstance | null> {
  const supabase = await createClient();

  // Get workspace with active_sandbox_id
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('active_sandbox_id')
    .eq('id', workspaceId)
    .single();

  if (workspaceError || !workspace?.active_sandbox_id) {
    return null;
  }

  // Get the active sandbox
  const { data: sandbox, error: sandboxError } = await supabase
    .from('sandbox_instances')
    .select('*')
    .eq('id', workspace.active_sandbox_id)
    .single();

  if (sandboxError) {
    console.error('[Lifecycle] Error fetching active sandbox:', sandboxError);
    return null;
  }

  return sandbox as SandboxInstance;
}

/**
 * Atomically replace workspace's active sandbox
 * 
 * Order of operations (critical for atomicity):
 * 1. Point workspace to new sandbox (atomic update)
 * 2. Mark old sandbox as 'replaced' (cleanup, not critical)
 * 
 * This ensures workspace always points to a valid sandbox,
 * even if step 2 fails.
 */
export async function replaceSandbox({
  workspaceId,
  newSandboxId,
  reason,
}: ReplaceSandboxParams): Promise<SandboxInstance> {
  console.log('[Lifecycle] ========================================');
  console.log('[Lifecycle] Starting atomic sandbox replacement');
  console.log('[Lifecycle] Workspace:', workspaceId);
  console.log('[Lifecycle] New sandbox:', newSandboxId);
  console.log('[Lifecycle] Reason:', reason);
  
  const supabase = await createClient();

  // 1. Get old sandbox (if any)
  const oldSandbox = await getActiveSandbox(workspaceId);
  console.log('[Lifecycle] Old sandbox:', oldSandbox?.id || 'none');

  // 2. Point workspace to NEW sandbox FIRST (atomic operation)
  console.log('[Lifecycle] Updating workspace.active_sandbox_id...');
  const { error: updateError } = await supabase
    .from('workspaces')
    .update({ active_sandbox_id: newSandboxId })
    .eq('id', workspaceId);

  if (updateError) {
    console.error('[Lifecycle] ✗ Failed to update workspace:', updateError);
    throw new Error(`Failed to update active sandbox: ${updateError.message}`);
  }

  console.log('[Lifecycle] ✓ Workspace now points to:', newSandboxId);

  // 3. Mark old sandbox as 'replaced' (cleanup, not critical)
  if (oldSandbox && oldSandbox.id !== newSandboxId) {
    console.log('[Lifecycle] Marking old sandbox as replaced...');
    
    const { error: replaceError } = await supabase
      .from('sandbox_instances')
      .update({
        status: 'replaced',
        preview_ready: false,
        error_message: reason,
        replaced_by_sandbox_id: newSandboxId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', oldSandbox.id);

    if (replaceError) {
      // Log but don't fail - workspace pointer is already updated
      console.warn('[Lifecycle] ⚠ Failed to mark old sandbox as replaced:', replaceError);
    } else {
      console.log('[Lifecycle] ✓ Old sandbox marked as replaced:', oldSandbox.id);
    }
  }

  // 4. Get and return new sandbox
  const { data: newSandbox, error: fetchError } = await supabase
    .from('sandbox_instances')
    .select('*')
    .eq('id', newSandboxId)
    .single();

  if (fetchError || !newSandbox) {
    throw new Error(`Failed to fetch new sandbox: ${fetchError?.message}`);
  }

  console.log('[Lifecycle] ✓ Sandbox replacement complete');
  console.log('[Lifecycle] ========================================');

  return newSandbox as SandboxInstance;
}

/**
 * Check if sandbox is reusable
 * 
 * A sandbox is reusable only if ALL are true:
 * - status === 'ready'
 * - preview_ready === true
 * - preview_url exists
 * - provider sandbox still exists (verified separately)
 * - preview health check passes (verified separately)
 */
export function isSandboxReusable(sandbox: SandboxInstance): boolean {
  return (
    sandbox.status === 'ready' &&
    sandbox.preview_ready === true &&
    !!sandbox.preview_url
  );
}

/**
 * Get sandbox by ID
 */
export async function getSandboxById(
  sandboxId: string
): Promise<SandboxInstance | null> {
  const supabase = await createClient();

  const { data: sandbox, error } = await supabase
    .from('sandbox_instances')
    .select('*')
    .eq('id', sandboxId)
    .single();

  if (error) {
    console.error('[Lifecycle] Error fetching sandbox:', error);
    return null;
  }

  return sandbox as SandboxInstance;
}

/**
 * Update workspace active sandbox
 * 
 * Direct update - use replaceSandbox() for proper cleanup
 */
export async function setWorkspaceActiveSandbox(
  workspaceId: string,
  sandboxId: string | null
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('workspaces')
    .update({ active_sandbox_id: sandboxId })
    .eq('id', workspaceId);

  if (error) {
    throw new Error(`Failed to set active sandbox: ${error.message}`);
  }
}
