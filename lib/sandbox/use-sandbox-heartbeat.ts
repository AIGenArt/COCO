/**
 * Sandbox Heartbeat Hook
 * 
 * Sends heartbeat every 30 seconds when sandbox is running.
 * Automatically starts/stops based on sandbox status.
 */

import { useEffect, useRef } from 'react';
import { SandboxStatus } from './types';

interface UseSandboxHeartbeatOptions {
  sandboxId: string | null;
  workspaceId: string;
  status: SandboxStatus | null;
  enabled?: boolean;
}

export function useSandboxHeartbeat({
  sandboxId,
  workspaceId,
  status,
  enabled = true,
}: UseSandboxHeartbeatOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  useEffect(() => {
    // Only send heartbeat when:
    // 1. Enabled
    // 2. Sandbox exists
    // 3. Status is 'running'
    const shouldSendHeartbeat = enabled && sandboxId && status === 'running';

    if (shouldSendHeartbeat && !isActiveRef.current) {
      console.log(`Starting heartbeat for sandbox ${sandboxId}`);
      isActiveRef.current = true;

      // Send initial heartbeat immediately
      sendHeartbeat(sandboxId, workspaceId);

      // Then send every 30 seconds
      intervalRef.current = setInterval(() => {
        sendHeartbeat(sandboxId, workspaceId);
      }, 30000); // 30 seconds

    } else if (!shouldSendHeartbeat && isActiveRef.current) {
      console.log(`Stopping heartbeat for sandbox ${sandboxId}`);
      isActiveRef.current = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isActiveRef.current = false;
    };
  }, [sandboxId, workspaceId, status, enabled]);
}

/**
 * Send heartbeat to server
 */
async function sendHeartbeat(sandboxId: string, workspaceId: string) {
  try {
    const response = await fetch(`/api/sandboxes/${sandboxId}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn(`Heartbeat failed for sandbox ${sandboxId}:`, error.error);
    } else {
      console.log(`Heartbeat sent for sandbox ${sandboxId}`);
    }
  } catch (error) {
    console.error(`Heartbeat error for sandbox ${sandboxId}:`, error);
  }
}
