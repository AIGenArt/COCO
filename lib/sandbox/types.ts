/**
 * Sandbox State Machine Types
 * 
 * Defines the lifecycle and state transitions for sandbox instances.
 * Ensures controlled state management and prevents invalid transitions.
 */

/**
 * Sandbox Status - Controlled state machine
 * 
 * Valid transitions:
 * - creating → starting → running
 * - running → stopping → stopped
 * - running → failed
 * - stopped → starting (restart)
 * - stopped/failed → destroying → destroyed
 * - Any state → failed (on error)
 */
export type SandboxStatus =
  | 'creating'    // Initial state - sandbox being provisioned
  | 'starting'    // Starting up (installing deps, booting server)
  | 'running'     // Active and healthy
  | 'stopping'    // Graceful shutdown in progress
  | 'stopped'     // Cleanly stopped
  | 'failed'      // Error state
  | 'destroying'  // Being torn down
  | 'destroyed';  // Fully cleaned up

/**
 * Sandbox instance data structure
 */
export interface SandboxInstance {
  id: string;
  workspace_id: string;
  status: SandboxStatus;
  container_id: string | null;
  port: number | null;
  preview_ready: boolean;
  last_seen_at: string | null;
  started_at: string | null;
  stopped_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Sandbox event types - Only centrale events
 */
export type SandboxEventType =
  | 'sandbox_created'
  | 'sandbox_starting'
  | 'sandbox_started'
  | 'sandbox_ready'      // Preview is ready
  | 'sandbox_stopping'
  | 'sandbox_stopped'
  | 'sandbox_failed'
  | 'sandbox_destroying'
  | 'sandbox_destroyed'
  | 'heartbeat_missed'   // Stale detection
  | 'cleanup_ran';       // Cleanup job executed

/**
 * Valid state transitions
 * 
 * Rules:
 * - failed only from operational states (creating, starting, running, stopping, destroying)
 * - destroyed is terminal (no transitions out)
 * - stopped can restart (stopped → starting) or be cleaned up (stopped → destroying)
 */
export const VALID_TRANSITIONS: Record<SandboxStatus, SandboxStatus[]> = {
  creating: ['starting', 'failed', 'destroying'],
  starting: ['running', 'failed', 'destroying'],
  running: ['stopping', 'failed', 'destroying'],
  stopping: ['stopped', 'failed', 'destroying'],
  stopped: ['starting', 'destroying'], // Can restart or be destroyed
  failed: ['destroying'], // Failed must be cleaned up, cannot go to destroyed directly
  destroying: ['destroyed', 'failed'], // Can fail during destruction
  destroyed: [], // Terminal state
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: SandboxStatus,
  to: SandboxStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  workspaceId: string;
  template?: string;
  port?: number;
}

/**
 * Heartbeat configuration
 */
export const HEARTBEAT_CONFIG = {
  INTERVAL_MS: 30000,        // Send heartbeat every 30 seconds
  STALE_THRESHOLD_MS: 90000, // Mark stale after 90 seconds (3 missed heartbeats)
  CLEANUP_INTERVAL_MS: 300000, // Run cleanup every 5 minutes
} as const;

/**
 * Sandbox limits
 */
export const SANDBOX_LIMITS = {
  MAX_ACTIVE_PER_WORKSPACE: 1, // MVP: Only one active sandbox per workspace
  MAX_LIFETIME_MS: 3600000,    // 1 hour max lifetime
} as const;
