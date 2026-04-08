/**
 * Sandbox Heartbeat Hook
 * 
 * Sends heartbeat every 30 seconds when sandbox is ready.
 * 
 * CRITICAL RULES:
 * - Only runs for status === 'ready' (not 'running')
 * - Stops IMMEDIATELY when sandbox ID changes
 * - Uses AbortController to cancel pending requests
 */

import { useEffect, useRef } from 'react';
import { SandboxStatus } from './types';

interface UseSandboxHeartbeatOptions {
  sandboxId: string | null;
  workspaceId: string;
  status: SandboxStatus | null;
  previewReady?: boolean;
  enabled?: boolean;
}

export function useSandboxHeartbeat({
  sandboxId,
  workspaceId,
  status,
  previewReady = false,
  enabled = true,
}: UseSandboxHeartbeatOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeSandboxIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // IMMEDIATE cleanup if sandbox ID changed
    if (activeSandboxIdRef.current && activeSandboxIdRef.current !== sandboxId) {
      console.log('[Heartbeat] ========================================');
      console.log('[Heartbeat] Active sandbox changed');
      console.log('[Heartbeat] Old:', activeSandboxIdRef.current);
      console.log('[Heartbeat] New:', sandboxId);
      console.log('[Heartbeat] Stopping heartbeat for old sandbox');
      console.log('[Heartbeat] ========================================');
      
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // Update active sandbox ID
    activeSandboxIdRef.current = sandboxId;

    // Only send heartbeat when ALL conditions met:
    // 1. Enabled
    // 2. Sandbox exists
    // 3. Status is 'ready' (NOT 'running')
    // 4. Preview is ready
    const shouldSendHeartbeat = 
      enabled && 
      sandboxId && 
      status === 'ready' && 
      previewReady === true;

    if (shouldSendHeartbeat && !intervalRef.current) {
      console.log('[Heartbeat] ========================================');
      console.log('[Heartbeat] Starting heartbeat');
      console.log('[Heartbeat] Sandbox ID:', sandboxId);
      console.log('[Heartbeat] Status:', status);
      console.log('[Heartbeat] Preview Ready:', previewReady);
      console.log('[Heartbeat] ========================================');

      // Create new AbortController
      abortControllerRef.current = new AbortController();

      // Send initial heartbeat immediately
      sendHeartbeat(sandboxId, workspaceId, abortControllerRef.current.signal);

      // Then send every 30 seconds
      intervalRef.current = setInterval(() => {
        if (activeSandboxIdRef.current === sandboxId) {
          sendHeartbeat(sandboxId, workspaceId, abortControllerRef.current!.signal);
        }
      }, 30000); // 30 seconds

    } else if (!shouldSendHeartbeat && intervalRef.current) {
      console.log('[Heartbeat] ========================================');
      console.log('[Heartbeat] Stopping heartbeat');
      console.log('[Heartbeat] Sandbox ID:', sandboxId);
      console.log('[Heartbeat] Status:', status);
      console.log('[Heartbeat] Preview Ready:', previewReady);
      console.log('[Heartbeat] Reason:', !enabled ? 'disabled' : !sandboxId ? 'no sandbox' : status !== 'ready' ? 'not ready' : 'preview not ready');
      console.log('[Heartbeat] ========================================');

      // Abort pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Clear interval
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sandboxId, workspaceId, status, previewReady, enabled]);
}

/**
 * Send heartbeat to server
 */
async function sendHeartbeat(
  sandboxId: string, 
  workspaceId: string, 
  signal: AbortSignal
) {
  try {
    const response = await fetch(`/api/sandboxes/${sandboxId}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn(`[Heartbeat] Failed for sandbox ${sandboxId}:`, error.error);
      
      // If 400/404, stop heartbeat immediately
      if (response.status === 400 || response.status === 404) {
        console.error('[Heartbeat] Sandbox no longer exists, stopping heartbeat');
      }
    } else {
      console.log(`[Heartbeat] ✓ Sent for sandbox ${sandboxId}`);
    }
  } catch (error) {
    // Ignore AbortError - it's expected when cleaning up
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[Heartbeat] Request aborted (expected during cleanup)');
      return;
    }
    
    console.error(`[Heartbeat] Error for sandbox ${sandboxId}:`, error);
  }
}
