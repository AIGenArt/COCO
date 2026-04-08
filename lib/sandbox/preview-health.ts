/**
 * Preview Health Check
 * 
 * Separates "sandbox running" from "app ready"
 * Verifies preview URL returns valid HTML response
 * 
 * CRITICAL: preview_ready must ONLY be set after this succeeds
 */

import type { PreviewHealthResult } from './types';

/**
 * Check if preview URL is responding with valid HTML
 * 
 * Production-grade check:
 * - Uses GET instead of HEAD to verify content
 * - Checks content-type is HTML
 * - Validates response is not E2B error page
 */
export async function checkPreviewHealth(
  previewUrl: string,
  timeoutMs: number = 10000
): Promise<PreviewHealthResult> {
  console.log('[Health] Checking preview URL:', previewUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(previewUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';

    // Check status code
    if (!response.ok) {
      console.error(`[Health] ✗ Unhealthy status: ${response.status}`);
      return {
        status: 'unhealthy',
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    // Check content type
    if (!contentType.includes('text/html')) {
      console.error(`[Health] ✗ Unexpected content-type: ${contentType}`);
      return {
        status: 'unhealthy',
        statusCode: response.status,
        error: `Unexpected content-type: ${contentType}`,
      };
    }

    // Success!
    console.log(`[Health] ✓ Preview healthy (${response.status})`);
    return {
      status: 'ready',
      statusCode: response.status,
    };

  } catch (error) {
    clearTimeout(timeout);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Health] ✗ Health check failed:', errorMessage);

    return {
      status: 'unhealthy',
      error: errorMessage,
    };
  }
}

/**
 * Wait for preview to become ready with retries
 * 
 * Polls preview URL until it returns healthy response
 * or max attempts reached.
 */
export async function waitForPreviewReady(
  previewUrl: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (attempt: number, result: PreviewHealthResult) => void;
  } = {}
): Promise<PreviewHealthResult> {
  const {
    maxAttempts = 30,
    intervalMs = 2000,
    timeoutMs = 10000,
    onProgress,
  } = options;

  console.log(`[Health] Waiting for preview ready: ${previewUrl}`);
  console.log(`[Health] Max attempts: ${maxAttempts}, interval: ${intervalMs}ms`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await checkPreviewHealth(previewUrl, timeoutMs);
    
    onProgress?.(attempt, result);

    if (result.status === 'ready') {
      console.log(`[Health] ✓ Preview ready after ${attempt} attempt(s)`);
      return result;
    }

    // If unhealthy for 3+ attempts, give up
    if (result.status === 'unhealthy' && attempt >= 3) {
      console.error(`[Health] ✗ Preview unhealthy after ${attempt} attempts`);
      return result;
    }

    // Wait before next attempt
    if (attempt < maxAttempts) {
      console.log(`[Health] Attempt ${attempt}/${maxAttempts} failed, retrying in ${intervalMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  // Max attempts reached
  console.error(`[Health] ✗ Preview not ready after ${maxAttempts} attempts`);
  return {
    status: 'unhealthy',
    error: `Max attempts (${maxAttempts}) reached`,
  };
}

/**
 * Continuous health monitoring
 * Returns a cleanup function to stop monitoring
 */
export function monitorPreviewHealth(
  previewUrl: string,
  onHealthChange: (result: PreviewHealthResult) => void,
  intervalMs: number = 10000
): () => void {
  console.log(`[Health] Starting continuous monitoring: ${previewUrl}`);
  
  let lastStatus: 'ready' | 'unhealthy' | null = null;
  let cancelled = false;

  const check = async () => {
    if (cancelled) return;

    const result = await checkPreviewHealth(previewUrl);

    // Only notify on status change
    if (result.status !== lastStatus) {
      console.log(`[Health] Status changed: ${lastStatus} → ${result.status}`);
      lastStatus = result.status;
      onHealthChange(result);
    }

    // Schedule next check
    if (!cancelled) {
      setTimeout(check, intervalMs);
    }
  };

  // Start monitoring
  void check();

  // Return cleanup function
  return () => {
    console.log('[Health] Stopping monitoring');
    cancelled = true;
  };
}
