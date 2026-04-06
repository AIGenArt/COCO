/**
 * Sandbox Manager
 * 
 * Manages sandbox lifecycle with controlled state transitions.
 * Enforces business rules and logs centrale events.
 */

import { createClient } from '@/lib/supabase/server';
import {
  SandboxStatus,
  SandboxInstance,
  SandboxEventType,
  isValidTransition,
  SANDBOX_LIMITS,
  HEARTBEAT_CONFIG,
} from './types';

/**
 * Sandbox Manager - Server-side only
 */
export class SandboxManager {
  /**
   * Create a new sandbox instance
   * Enforces: Max 1 active sandbox per workspace
   */
  static async createSandbox(workspaceId: string): Promise<SandboxInstance> {
    const supabase = await createClient();

    // Check for existing active sandbox
    const { data: existingSandboxes } = await supabase
      .from('sandbox_instances')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['creating', 'starting', 'running']);

    if (existingSandboxes && existingSandboxes.length >= SANDBOX_LIMITS.MAX_ACTIVE_PER_WORKSPACE) {
      throw new Error(
        `Workspace already has ${SANDBOX_LIMITS.MAX_ACTIVE_PER_WORKSPACE} active sandbox(es). Stop existing sandbox first.`
      );
    }

    // Create new sandbox
    const { data: sandbox, error } = await supabase
      .from('sandbox_instances')
      .insert({
        workspace_id: workspaceId,
        status: 'creating',
        preview_ready: false,
      })
      .select()
      .single();

    if (error || !sandbox) {
      throw new Error(`Failed to create sandbox: ${error?.message}`);
    }

    // Log event
    await this.logEvent(sandbox.id, workspaceId, 'sandbox_created', 'info', 'Sandbox created');

    return sandbox as SandboxInstance;
  }

  /**
   * Transition sandbox to new status
   * Validates transition and logs event
   */
  static async transitionStatus(
    sandboxId: string,
    newStatus: SandboxStatus,
    errorMessage?: string
  ): Promise<SandboxInstance> {
    const supabase = await createClient();

    // Get current sandbox
    const { data: sandbox, error: fetchError } = await supabase
      .from('sandbox_instances')
      .select('*')
      .eq('id', sandboxId)
      .single();

    if (fetchError || !sandbox) {
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }

    const currentStatus = sandbox.status as SandboxStatus;

    // Validate transition
    if (!isValidTransition(currentStatus, newStatus)) {
      throw new Error(
        `Invalid state transition: ${currentStatus} → ${newStatus}`
      );
    }

    // Build update object
    const updates: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Set timestamps based on status
    if (newStatus === 'running' && !sandbox.started_at) {
      updates.started_at = new Date().toISOString();
      updates.last_seen_at = new Date().toISOString();
    }

    if (newStatus === 'stopped' || newStatus === 'destroyed') {
      updates.stopped_at = new Date().toISOString();
    }

    if (newStatus === 'failed' && errorMessage) {
      updates.error_message = errorMessage;
    }

    // Reset preview_ready when leaving running state
    if (currentStatus === 'running' && newStatus !== 'running') {
      updates.preview_ready = false;
    }

    // Reset preview_ready on restart
    if (currentStatus === 'stopped' && newStatus === 'starting') {
      updates.preview_ready = false;
    }

    // Reset preview_ready on failure or destruction
    if (newStatus === 'failed' || newStatus === 'destroying' || newStatus === 'destroyed') {
      updates.preview_ready = false;
    }

    // Update sandbox
    const { data: updated, error: updateError } = await supabase
      .from('sandbox_instances')
      .update(updates)
      .eq('id', sandboxId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update sandbox: ${updateError?.message}`);
    }

    // Log event
    const eventType = this.getEventTypeForStatus(newStatus);
    const message = errorMessage || `Sandbox transitioned to ${newStatus}`;
    await this.logEvent(sandboxId, sandbox.workspace_id, eventType, newStatus === 'failed' ? 'error' : 'info', message);

    return updated as SandboxInstance;
  }

  /**
   * Update heartbeat (last_seen_at)
   * Only for running sandboxes
   * Validates that this sandbox is still the active one for its workspace
   */
  static async updateHeartbeat(sandboxId: string, workspaceId: string): Promise<void> {
    const supabase = await createClient();

    // Verify this is still the active sandbox for the workspace
    const activeSandbox = await this.getActiveSandbox(workspaceId);
    
    if (!activeSandbox || activeSandbox.id !== sandboxId) {
      console.warn(`Heartbeat rejected: Sandbox ${sandboxId} is not the active sandbox for workspace ${workspaceId}`);
      return;
    }

    // Update heartbeat only if status is running
    const { error } = await supabase
      .from('sandbox_instances')
      .update({
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sandboxId)
      .eq('status', 'running');

    if (error) {
      console.error(`Failed to update heartbeat for sandbox ${sandboxId}:`, error);
    }
  }

  /**
   * Mark preview as ready
   * Only after healthcheck passes
   */
  static async markPreviewReady(sandboxId: string): Promise<void> {
    console.log('[Preview Ready] ========================================');
    console.log('[Preview Ready] markPreviewReady called for sandbox:', sandboxId);
    console.log('[Preview Ready] Timestamp:', new Date().toISOString());
    
    const supabase = await createClient();

    // Verify sandbox is running
    const { data: sandbox } = await supabase
      .from('sandbox_instances')
      .select('status, workspace_id')
      .eq('id', sandboxId)
      .single();

    console.log('[Preview Ready] Current sandbox status:', sandbox?.status);
    console.log('[Preview Ready] Workspace ID:', sandbox?.workspace_id);

    if (!sandbox || sandbox.status !== 'running') {
      console.error('[Preview Ready] ✗ Cannot mark preview ready - sandbox not running');
      throw new Error('Sandbox must be running to mark preview ready');
    }

    // Update preview_ready
    console.log('[Preview Ready] Updating database...');
    const { error, data: updated } = await supabase
      .from('sandbox_instances')
      .update({
        preview_ready: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sandboxId)
      .select()
      .single();

    if (error) {
      console.error('[Preview Ready] ✗ Database update failed:', error);
      throw new Error(`Failed to mark preview ready: ${error.message}`);
    }

    console.log('[Preview Ready] ✓ Database updated successfully');
    console.log('[Preview Ready] Updated sandbox:', {
      id: updated?.id,
      status: updated?.status,
      preview_ready: updated?.preview_ready,
    });

    // Log event
    await this.logEvent(sandboxId, sandbox.workspace_id, 'sandbox_ready', 'info', 'Preview is ready');
    
    console.log('[Preview Ready] ✓ Event logged');
    console.log('[Preview Ready] ========================================');
  }

  /**
   * Get active sandbox for workspace
   */
  static async getActiveSandbox(workspaceId: string): Promise<SandboxInstance | null> {
    const supabase = await createClient();

    const { data: sandbox } = await supabase
      .from('sandbox_instances')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['creating', 'starting', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return sandbox as SandboxInstance | null;
  }

  /**
   * Find stale sandboxes
   * Sandboxes with no heartbeat for > STALE_THRESHOLD_MS
   */
  static async findStaleSandboxes(): Promise<SandboxInstance[]> {
    const supabase = await createClient();

    const staleThreshold = new Date(
      Date.now() - HEARTBEAT_CONFIG.STALE_THRESHOLD_MS
    ).toISOString();

    const { data: sandboxes } = await supabase
      .from('sandbox_instances')
      .select('*')
      .eq('status', 'running')
      .lt('last_seen_at', staleThreshold);

    return (sandboxes || []) as SandboxInstance[];
  }

  /**
   * Cleanup stale sandboxes
   * Marks them as failed and logs event
   */
  static async cleanupStaleSandboxes(): Promise<number> {
    const staleSandboxes = await this.findStaleSandboxes();
    let cleanedCount = 0;

    for (const sandbox of staleSandboxes) {
      try {
        await this.transitionStatus(
          sandbox.id,
          'failed',
          'Sandbox became stale (no heartbeat)'
        );

        await this.logEvent(
          sandbox.id,
          sandbox.workspace_id,
          'heartbeat_missed',
          'warning',
          'Sandbox marked as stale due to missed heartbeats'
        );

        cleanedCount++;
      } catch (error) {
        console.error(`Failed to cleanup stale sandbox ${sandbox.id}:`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} stale sandbox(es)`);
    }

    return cleanedCount;
  }

  /**
   * Log sandbox event (non-blocking)
   */
  private static async logEvent(
    sandboxId: string,
    workspaceId: string,
    eventType: SandboxEventType,
    severity: 'info' | 'warning' | 'error',
    message: string
  ): Promise<void> {
    const supabase = await createClient();

    // Fire-and-forget
    void supabase
      .from('sandbox_events')
      .insert({
        sandbox_id: sandboxId,
        workspace_id: workspaceId,
        event_type: eventType,
        severity,
        message,
      });
  }

  /**
   * Map status to event type
   */
  private static getEventTypeForStatus(status: SandboxStatus): SandboxEventType {
    const mapping: Record<SandboxStatus, SandboxEventType> = {
      creating: 'sandbox_created',
      starting: 'sandbox_starting',
      running: 'sandbox_started',
      stopping: 'sandbox_stopping',
      stopped: 'sandbox_stopped',
      failed: 'sandbox_failed',
      destroying: 'sandbox_destroying',
      destroyed: 'sandbox_destroyed',
    };

    return mapping[status];
  }
}
