/**
 * Sandbox Status Polling Hook
 * 
 * Polls sandbox status during unstable states.
 * Uses dynamic intervals and exponential backoff on errors.
 */

import { useEffect, useRef, useState } from 'react';
import { SandboxStatus, SandboxInstance } from './types';

interface UseSandboxStatusOptions {
  sandboxId: string | null;
  enabled?: boolean;
  onStatusChange?: (sandbox: SandboxInstance) => void;
}

// Unstable states that require polling
const UNSTABLE_STATES: SandboxStatus[] = [
  'creating',
  'starting',
  'running',  // Keep polling until preview_ready = true
  'stopping',
  'destroying',
];

// Stable states where polling should stop
const STABLE_STATES: SandboxStatus[] = [
  'stopped',
  'failed',
  'destroyed',
];

// Dynamic polling intervals based on state
const POLL_INTERVALS: Record<string, number> = {
  creating: 2000,   // 2 seconds
  starting: 2000,   // 2 seconds
  running: 2000,    // 2 seconds - poll until preview_ready
  stopping: 5000,   // 5 seconds
  destroying: 5000, // 5 seconds
};

export function useSandboxStatus({
  sandboxId,
  enabled = true,
  onStatusChange,
}: UseSandboxStatusOptions) {
  const [sandbox, setSandbox] = useState<SandboxInstance | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const currentStatusRef = useRef<SandboxStatus | null>(null);

  // Poll function with exponential backoff
  const poll = async () => {
    if (!sandboxId || !enabled) return;

    try {
      const response = await fetch(`/api/sandboxes/${sandboxId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sandbox status: ${response.statusText}`);
      }

      const data = await response.json();
      const fetchedSandbox = data.sandbox as SandboxInstance;
      
      // Log what we received
      console.log('[Frontend Polling] Received sandbox state:', {
        id: fetchedSandbox.id,
        status: fetchedSandbox.status,
        preview_ready: fetchedSandbox.preview_ready,
        container_id: fetchedSandbox.container_id,
        port: fetchedSandbox.port,
      });
      
      // Reset retry count on success
      retryCountRef.current = 0;
      setError(null);
      
      // Update sandbox state
      setSandbox(fetchedSandbox);
      currentStatusRef.current = fetchedSandbox.status;
      
      // Notify parent of status change
      if (onStatusChange) {
        onStatusChange(fetchedSandbox);
      }

      // Determine if we should continue polling
      // Continue polling if:
      // 1. Status is in UNSTABLE_STATES, OR
      // 2. Status is 'running' but preview is not ready yet
      const shouldContinuePolling = 
        UNSTABLE_STATES.includes(fetchedSandbox.status) ||
        (fetchedSandbox.status === 'running' && !fetchedSandbox.preview_ready);
      
      if (shouldContinuePolling) {
        // Schedule next poll with appropriate interval
        const interval = POLL_INTERVALS[fetchedSandbox.status] || 2000;
        
        timeoutRef.current = setTimeout(() => {
          void poll();
        }, interval);
      } else {
        // Stable state reached - stop polling
        console.log(`Sandbox ${sandboxId} reached stable state: ${fetchedSandbox.status}, preview_ready: ${fetchedSandbox.preview_ready}`);
        setIsPolling(false);
      }

    } catch (err) {
      console.error('Error polling sandbox status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      
      // Exponential backoff: 2s → 4s → 8s → max 15s
      retryCountRef.current++;
      const backoffDelay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 15000);
      
      console.log(`Retrying in ${backoffDelay}ms (attempt ${retryCountRef.current})`);
      
      timeoutRef.current = setTimeout(() => {
        void poll();
      }, backoffDelay);
    }
  };

  // Start polling when sandbox ID changes or status becomes unstable
  useEffect(() => {
    if (!sandboxId || !enabled) {
      setIsPolling(false);
      return;
    }

    // Check if current status requires polling
    const needsPolling = !currentStatusRef.current || 
                        UNSTABLE_STATES.includes(currentStatusRef.current);

    if (needsPolling && !isPolling) {
      console.log(`Starting status polling for sandbox ${sandboxId}`);
      setIsPolling(true);
      retryCountRef.current = 0;
      void poll();
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [sandboxId, enabled]);

  // Manual refresh function
  const refresh = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    retryCountRef.current = 0;
    void poll();
  };

  return {
    sandbox,
    isPolling,
    error,
    refresh,
  };
}
