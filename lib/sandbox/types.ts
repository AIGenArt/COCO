/**
 * Sandbox State Machine Types
 * 
 * Defines the lifecycle and state transitions for sandbox instances.
 * Ensures controlled state management and prevents invalid transitions.
 */

/**
 * Sandbox Status - Production-grade state machine
 * 
 * Valid transitions:
 * - creating → bootstrapping → starting → running → ready
 * - ready → stopping → terminated
 * - ready → replaced (when new sandbox becomes active)
 * - Any operational state → failed (on error)
 * 
 * CRITICAL: Only 'ready' status may be previewed in UI or heartbeated
 */
export type SandboxStatus =
  | 'creating'       // Provider sandbox being created
  | 'bootstrapping'  // Files/materialization/validation
  | 'starting'       // Dependencies + dev server start
  | 'running'        // Sandbox alive, app not yet verified
  | 'ready'          // Preview health verified, safe for UI/heartbeat
  | 'stopping'       // Intentional shutdown
  | 'terminated'     // Ended normally or removed
  | 'failed'         // Unrecoverable start/bootstrap/runtime failure
  | 'replaced';      // Old sandbox superseded by new active sandbox

/**
 * Bootstrap mode - How workspace source is materialized
 */
export type BootstrapMode = 'template' | 'repo';

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
  preview_url: string | null;
  bootstrap_mode: BootstrapMode | null;
  replaced_by_sandbox_id: string | null;
  last_seen_at: string | null;
  started_at: string | null;
  stopped_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Workspace with active sandbox reference
 */
export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  active_sandbox_id: string | null;  // SINGLE SOURCE OF TRUTH
  created_at: string;
  updated_at: string;
}

/**
 * Sandbox event types - Only centrale events
 */
export type SandboxEventType =
  | 'sandbox_created'
  | 'sandbox_bootstrapping'
  | 'sandbox_starting'
  | 'sandbox_started'
  | 'sandbox_ready'      // Preview is ready
  | 'sandbox_stopping'
  | 'sandbox_stopped'
  | 'sandbox_failed'
  | 'sandbox_replaced'   // Superseded by new sandbox
  | 'sandbox_destroying'
  | 'sandbox_destroyed'
  | 'heartbeat_missed'   // Stale detection
  | 'cleanup_ran';       // Cleanup job executed

/**
 * Valid state transitions
 * 
 * Rules:
 * - Only 'ready' may be previewed or heartbeated
 * - 'replaced' is for old sandboxes superseded by new active sandbox
 * - 'terminated' is normal end state
 * - 'failed' is error end state
 */
export const VALID_TRANSITIONS: Record<SandboxStatus, SandboxStatus[]> = {
  creating: ['bootstrapping', 'failed'],
  bootstrapping: ['starting', 'failed'],
  starting: ['running', 'failed'],
  running: ['ready', 'failed', 'terminated'],
  ready: ['stopping', 'failed', 'replaced', 'terminated'],
  stopping: ['terminated', 'failed'],
  terminated: ['replaced'], // Can be marked as replaced after termination
  failed: ['replaced'],     // Can be marked as replaced after failure
  replaced: [],             // Terminal state
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
  bootstrapMode?: BootstrapMode;
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
  MAX_ACTIVE_PER_WORKSPACE: 1, // Only one active sandbox per workspace
  MAX_LIFETIME_MS: 3600000,    // 1 hour max lifetime
} as const;

/**
 * Bootstrap validation result
 */
export interface BootstrapValidationResult {
  ok: boolean;
  missing: string[];
  details?: string[];
}

/**
 * Preview health result
 */
export type PreviewHealthResult =
  | { status: 'ready'; statusCode: number }
  | { status: 'unhealthy'; statusCode?: number; error: string };
