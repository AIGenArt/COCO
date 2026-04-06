import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizePreviewUrl } from './preview-url';

export type SandboxStatus = 
  | 'idle'
  | 'creating'
  | 'starting'
  | 'installing'
  | 'booting'
  | 'running'
  | 'failed'
  | 'stopped';

export interface SandboxState {
  status: SandboxStatus;
  sandboxId: string | null;
  previewUrl: string | null;
  error: string | null;
  statusMessage: string;
}

export interface UseSandboxLifecycleOptions {
  workspaceId: string;
  onReady?: (url: string) => void;
  onError?: (error: string) => void;
}

/**
 * Hook to manage sandbox lifecycle with loading states
 * 
 * CRITICAL GUARDS:
 * - Only starts sandbox once (prevents double-start from React Strict Mode)
 * - Polling only checks status, never restarts sandbox
 * - Proper cleanup of intervals
 * - Max retry logic with backoff
 */
export function useSandboxLifecycle({
  workspaceId,
  onReady,
  onError,
}: UseSandboxLifecycleOptions) {
  const [state, setState] = useState<SandboxState>({
    status: 'idle',
    sandboxId: null,
    previewUrl: null,
    error: null,
    statusMessage: 'Initializing...',
  });

  // CRITICAL: Prevent double-start from React Strict Mode or re-renders
  const isStartingRef = useRef(false);
  const hasStartedRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;


  /**
   * Start sandbox creation with retry logic
   */
  const startSandbox = useCallback(async () => {
    // GUARD: Prevent multiple simultaneous starts
    if (isStartingRef.current || hasStartedRef.current) {
      console.log('[Sandbox Lifecycle] Already starting or started, skipping');
      return;
    }

    // Check retry limit
    if (retryCountRef.current >= maxRetries) {
      console.error('[Sandbox Lifecycle] Max retries reached');
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: 'Max retries reached',
        statusMessage: 'Failed to start sandbox after multiple attempts',
      }));
      onError?.('Max retries reached');
      return;
    }

    isStartingRef.current = true;
    retryCountRef.current += 1;

    console.log(`[Sandbox Lifecycle] Starting sandbox (attempt ${retryCountRef.current}/${maxRetries})...`);

    setState(prev => ({
      ...prev,
      status: 'creating',
      statusMessage: 'Creating sandbox...',
      error: null,
    }));

    try {
      const response = await fetch('/api/sandboxes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to create sandbox');
      }

      const data = await response.json();

      console.log('[Sandbox Lifecycle] Sandbox created:', data.sandbox.id);

      setState(prev => ({
        ...prev,
        sandboxId: data.sandbox.id,
        status: 'starting',
        statusMessage: 'Installing packages...',
      }));

      // Mark as successfully started
      hasStartedRef.current = true;

      // Start polling for status (ONLY polls, never restarts)
      startPolling(data.sandbox.id);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Sandbox Lifecycle] Start failed:', errorMessage);
      
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: errorMessage,
        statusMessage: `Failed: ${errorMessage}`,
      }));

      onError?.(errorMessage);

      // Retry with exponential backoff
      if (retryCountRef.current < maxRetries) {
        const backoffMs = retryCountRef.current * 2000;
        console.log(`[Sandbox Lifecycle] Retrying in ${backoffMs}ms...`);
        
        setTimeout(() => {
          isStartingRef.current = false;
          startSandbox();
        }, backoffMs);
      }
    } finally {
      if (hasStartedRef.current) {
        isStartingRef.current = false;
      }
    }
  }, [workspaceId, onError]);

  /**
   * Retry sandbox creation (resets state and creates new sandbox)
   */
  const retrySandbox = useCallback(async () => {
    console.log('[Sandbox Lifecycle] Retrying sandbox creation...');
    
    // Reset all state
    setState({
      status: 'idle',
      sandboxId: null,
      previewUrl: null,
      error: null,
      statusMessage: 'Initializing...',
    });
    
    // Reset refs
    isStartingRef.current = false;
    hasStartedRef.current = false;
    retryCountRef.current = 0;
    
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Clear the old sandbox reference from database
    try {
      await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandbox_id: null }),
      });
      console.log('[Sandbox Lifecycle] Cleared old sandbox reference');
    } catch (error) {
      console.error('[Sandbox Lifecycle] Failed to clear sandbox reference:', error);
    }
    
    // Start fresh
    await startSandbox();
  }, [workspaceId, startSandbox]);

  /**
   * Poll sandbox status (ONLY checks status, NEVER restarts sandbox)
   */
  const startPolling = useCallback((sandboxId: string) => {
    // GUARD: Prevent starting polling if already polling
    if (pollingIntervalRef.current) {
      console.log('[Sandbox Lifecycle] Polling already active, skipping');
      return;
    }

    console.log('[Sandbox Lifecycle] Starting status polling...');

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sandboxes/${sandboxId}/status`);
        
        if (!response.ok) {
          throw new Error('Failed to get sandbox status');
        }

        const data = await response.json();

        // Map database status to UI status
        let uiStatus: SandboxStatus = 'starting';
        let statusMessage = 'Starting...';

        switch (data.status) {
          case 'creating':
            uiStatus = 'creating';
            statusMessage = 'Creating sandbox...';
            break;
          case 'starting':
            uiStatus = 'installing';
            statusMessage = 'Installing packages...';
            break;
          case 'running':
            if (data.previewReady) {
              uiStatus = 'running';
              statusMessage = 'Ready!';
              
              // Build and normalize preview URL (remove port - E2B handles forwarding)
              const rawUrl = `https://${data.containerId}.e2b.dev:${data.port}`;
              const previewUrl = normalizePreviewUrl(rawUrl);
              
              console.log('[Sandbox Lifecycle] Raw preview URL:', rawUrl);
              console.log('[Sandbox Lifecycle] Normalized preview URL:', previewUrl);
              
              setState(prev => ({
                ...prev,
                status: uiStatus,
                statusMessage,
                previewUrl,
              }));

              // Stop polling - we're done!
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }

              // Notify ready
              onReady?.(previewUrl);
              return;
            } else {
              uiStatus = 'booting';
              statusMessage = 'Starting dev server...';
            }
            break;
          case 'failed':
          case 'terminated':
            // Stop polling first
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            // Auto-retry if terminated (sandbox expired, not a user error)
            if (data.status === 'terminated') {
              console.log('[Sandbox] Terminated sandbox detected, auto-retrying...');
              
              // Reset refs to allow new creation
              hasStartedRef.current = false;
              isStartingRef.current = false;
              retryCountRef.current = 0;
              
              // Clear old sandbox_id from database
              try {
                await fetch(`/api/workspaces/${workspaceId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sandbox_id: null }),
                });
                console.log('[Sandbox] Cleared terminated sandbox reference');
              } catch (error) {
                console.error('[Sandbox] Failed to clear sandbox reference:', error);
              }
              
              // Show creating state
              setState({
                status: 'creating',
                sandboxId: null,
                previewUrl: null,
                error: null,
                statusMessage: 'Creating new sandbox...',
              });
              
              // Start new sandbox after brief delay
              setTimeout(() => {
                startSandbox();
              }, 1000);
              
              return;
            }
            
            // For other failures, show error UI and wait for user action
            uiStatus = 'failed';
            statusMessage = `Failed: ${data.errorMessage || 'Unknown error'}`;
            
            console.error('[Sandbox Lifecycle] Sandbox failed:', data.errorMessage);
            
            setState(prev => ({
              ...prev,
              status: uiStatus,
              statusMessage,
              error: data.errorMessage || statusMessage,
            }));

            onError?.(data.errorMessage || statusMessage);
            return;
        }

        setState(prev => ({
          ...prev,
          status: uiStatus,
          statusMessage,
        }));

      } catch (error) {
        console.error('[Sandbox Lifecycle] Polling error:', error);
        // Don't stop polling on transient errors
      }
    }, 2000); // Poll every 2 seconds

    pollingIntervalRef.current = interval;
  }, [onReady, onError, workspaceId, startSandbox]);

  /**
   * Check if sandbox already exists
   */
  const checkExistingSandbox = useCallback(async () => {
    // GUARD: Don't check if already starting or started
    if (isStartingRef.current || hasStartedRef.current) {
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`);
      
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      
      if (data.workspace.sandbox_id) {
        console.log('[Sandbox Lifecycle] Found existing sandbox:', data.workspace.sandbox_id);
        
        // Mark as started to prevent new creation
        hasStartedRef.current = true;
        
        // Sandbox exists, check its status
        setState(prev => ({
          ...prev,
          sandboxId: data.workspace.sandbox_id,
          status: 'starting',
          statusMessage: 'Reconnecting to sandbox...',
        }));

        startPolling(data.workspace.sandbox_id);
      }
    } catch (error) {
      console.error('[Sandbox Lifecycle] Error checking existing sandbox:', error);
    }
  }, [workspaceId, startPolling]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log('[Sandbox Lifecycle] Cleaning up...');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Check for existing sandbox on mount (ONLY ONCE)
   * DISABLED: Let API handle idempotency instead
   */
  useEffect(() => {
    // checkExistingSandbox(); // DISABLED - API handles reconnection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  return {
    state,
    startSandbox,
    retrySandbox,
    isLoading: ['creating', 'starting', 'installing', 'booting'].includes(state.status),
    isReady: state.status === 'running',
    isFailed: state.status === 'failed',
  };
}
