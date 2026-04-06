/**
 * Sandbox Verification Module
 * 
 * Provides verified idempotency for sandbox reuse.
 * A sandbox is only reusable if ALL verification steps pass.
 */

import { E2BManager } from './e2b-manager';
import { checkPreviewHealth } from './preview-health';
import { normalizePreviewUrl } from './preview-url';

export interface SandboxRecord {
  id: string;
  workspace_id: string;
  container_id: string | null;
  status: string;
  preview_ready: boolean;
  port: number;
  error_message: string | null;
}

export interface VerificationResult {
  reusable: boolean;
  reason?: string;
  shouldTerminate: boolean;
}

/**
 * Verify if a sandbox is truly reusable
 * 
 * A sandbox is reusable ONLY if ALL of these pass:
 * 1. DB status is 'running'
 * 2. preview_ready = true
 * 3. Reconnect to E2B provider succeeds
 * 4. Provider reports sandbox is alive
 * 5. Preview health check passes
 * 
 * If ANY check fails, sandbox should be terminated and replaced.
 */
export async function verifySandboxReusable(
  sandbox: SandboxRecord
): Promise<VerificationResult> {
  console.log('[Sandbox Verification] ========================================');
  console.log('[Sandbox Verification] Verifying sandbox:', sandbox.id);
  console.log('[Sandbox Verification] Container ID:', sandbox.container_id);
  console.log('[Sandbox Verification] Status:', sandbox.status);
  console.log('[Sandbox Verification] Preview Ready:', sandbox.preview_ready);
  
  // Check 1: DB status must be 'running'
  if (sandbox.status !== 'running') {
    console.log('[Sandbox Verification] ✗ Check 1 failed: Status is not running');
    return {
      reusable: false,
      reason: `Status is ${sandbox.status}, not running`,
      shouldTerminate: true,
    };
  }
  console.log('[Sandbox Verification] ✓ Check 1 passed: Status is running');

  // Check 2: preview_ready must be true
  if (!sandbox.preview_ready) {
    console.log('[Sandbox Verification] ✗ Check 2 failed: Preview not ready');
    return {
      reusable: false,
      reason: 'Preview not marked as ready',
      shouldTerminate: true,
    };
  }
  console.log('[Sandbox Verification] ✓ Check 2 passed: Preview marked as ready');

  // Check 3: Must have container_id
  if (!sandbox.container_id) {
    console.log('[Sandbox Verification] ✗ Check 3 failed: No container ID');
    return {
      reusable: false,
      reason: 'No container ID',
      shouldTerminate: true,
    };
  }
  console.log('[Sandbox Verification] ✓ Check 3 passed: Has container ID');

  // Check 4: Reconnect to E2B provider must succeed
  try {
    console.log('[Sandbox Verification] Check 4: Attempting to reconnect to E2B...');
    await E2BManager.getOrReconnectSandbox(sandbox.container_id);
    console.log('[Sandbox Verification] ✓ Check 4 passed: Successfully reconnected to E2B');
  } catch (error) {
    console.log('[Sandbox Verification] ✗ Check 4 failed: Cannot reconnect to E2B');
    console.log('[Sandbox Verification] Error:', error instanceof Error ? error.message : 'Unknown error');
    return {
      reusable: false,
      reason: 'Cannot reconnect to E2B provider',
      shouldTerminate: true,
    };
  }

  // Check 5: Preview health check must pass
  try {
    console.log('[Sandbox Verification] Check 5: Running preview health check...');
    const rawUrl = `https://${sandbox.container_id}.e2b.dev:${sandbox.port}`;
    const previewUrl = normalizePreviewUrl(rawUrl);
    console.log('[Sandbox Verification] Preview URL:', previewUrl);
    
    const healthResult = await checkPreviewHealth(previewUrl, 5000);
    
    if (healthResult.status !== 'ready') {
      console.log('[Sandbox Verification] ✗ Check 5 failed: Health check did not pass');
      console.log('[Sandbox Verification] Health status:', healthResult.status);
      console.log('[Sandbox Verification] Health error:', healthResult.error);
      return {
        reusable: false,
        reason: `Health check failed: ${healthResult.error || healthResult.status}`,
        shouldTerminate: true,
      };
    }
    
    console.log('[Sandbox Verification] ✓ Check 5 passed: Health check successful');
    console.log('[Sandbox Verification] Response time:', healthResult.responseTime, 'ms');
  } catch (error) {
    console.log('[Sandbox Verification] ✗ Check 5 failed: Health check threw error');
    console.log('[Sandbox Verification] Error:', error instanceof Error ? error.message : 'Unknown error');
    return {
      reusable: false,
      reason: 'Health check threw error',
      shouldTerminate: true,
    };
  }

  // All checks passed!
  console.log('[Sandbox Verification] ========================================');
  console.log('[Sandbox Verification] ✓✓✓ ALL CHECKS PASSED ✓✓✓');
  console.log('[Sandbox Verification] Sandbox is verified reusable');
  console.log('[Sandbox Verification] ========================================');
  
  return {
    reusable: true,
    shouldTerminate: false,
  };
}
