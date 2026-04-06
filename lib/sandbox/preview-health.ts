/**
 * Preview Health Check
 * 
 * Separates "sandbox running" from "app ready"
 * Polls preview URL to verify app is actually responding
 */

export type PreviewHealthStatus = 'booting' | 'ready' | 'unhealthy';

export interface PreviewHealthResult {
  status: PreviewHealthStatus;
  url: string;
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}

/**
 * Check if preview URL is responding and healthy
 */
export async function checkPreviewHealth(
  previewUrl: string,
  timeoutMs: number = 5000
): Promise<PreviewHealthResult> {
  const startTime = Date.now();
  const lastChecked = new Date();

  try {
    console.log('[Preview Health] Checking:', previewUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(previewUrl, {
      method: 'HEAD',
      signal: controller.signal,
      // Don't follow redirects for health check
      redirect: 'manual',
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;

    // Accept 2xx, 3xx as healthy
    // 404 might be OK if app is running but route doesn't exist
    if (response.status >= 200 && response.status < 400) {
      console.log(`[Preview Health] ✓ Healthy (${response.status}) in ${responseTime}ms`);
      return {
        status: 'ready',
        url: previewUrl,
        responseTime,
        lastChecked,
      };
    }

    // 5xx or other errors = unhealthy
    console.warn(`[Preview Health] ⚠ Unhealthy status: ${response.status}`);
    return {
      status: 'unhealthy',
      url: previewUrl,
      responseTime,
      error: `HTTP ${response.status}`,
      lastChecked,
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Timeout or network error = still booting or unhealthy
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[Preview Health] ⏱ Timeout - still booting');
      return {
        status: 'booting',
        url: previewUrl,
        responseTime,
        error: 'Timeout',
        lastChecked,
      };
    }

    // Connection refused = still booting
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('[Preview Health] 🔌 Connection refused - still booting');
      return {
        status: 'booting',
        url: previewUrl,
        responseTime,
        error: 'Connection refused',
        lastChecked,
      };
    }

    // Other errors = unhealthy
    console.error('[Preview Health] ✗ Error:', error);
    return {
      status: 'unhealthy',
      url: previewUrl,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked,
    };
  }
}

/**
 * Poll preview URL until it becomes healthy or max attempts reached
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
    timeoutMs = 5000,
    onProgress,
  } = options;

  console.log(`[Preview Health] Waiting for preview to be ready: ${previewUrl}`);
  console.log(`[Preview Health] Max attempts: ${maxAttempts}, interval: ${intervalMs}ms`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await checkPreviewHealth(previewUrl, timeoutMs);
    
    onProgress?.(attempt, result);

    if (result.status === 'ready') {
      console.log(`[Preview Health] ✓ Preview ready after ${attempt} attempts`);
      return result;
    }

    if (result.status === 'unhealthy' && attempt >= 3) {
      // If unhealthy for 3+ attempts, give up
      console.error(`[Preview Health] ✗ Preview unhealthy after ${attempt} attempts`);
      return result;
    }

    // Wait before next attempt
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  // Max attempts reached
  console.error(`[Preview Health] ✗ Preview not ready after ${maxAttempts} attempts`);
  return {
    status: 'unhealthy',
    url: previewUrl,
    error: `Max attempts (${maxAttempts}) reached`,
    lastChecked: new Date(),
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
  console.log(`[Preview Health] Starting continuous monitoring: ${previewUrl}`);
  
  let lastStatus: PreviewHealthStatus | null = null;
  let cancelled = false;

  const check = async () => {
    if (cancelled) return;

    const result = await checkPreviewHealth(previewUrl);

    // Only notify on status change
    if (result.status !== lastStatus) {
      console.log(`[Preview Health] Status changed: ${lastStatus} → ${result.status}`);
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
    console.log('[Preview Health] Stopping monitoring');
    cancelled = true;
  };
}
