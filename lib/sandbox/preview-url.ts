/**
 * Preview URL Normalization
 * 
 * Ensures consistent preview URLs across the system.
 * E2B handles port forwarding automatically, so external URLs should not include :3000
 */

/**
 * Normalize preview URL for external use
 * Removes port from E2B URLs since they handle port forwarding
 */
export function normalizePreviewUrl(input: string): string {
  try {
    const url = new URL(input);
    
    // Check if this is an E2B host
    const isE2BHost = 
      url.hostname.endsWith('.e2b.dev') || 
      url.hostname.endsWith('.e2b-staging.dev');
    
    // Remove port 3000 from E2B URLs (they handle port forwarding)
    if (isE2BHost && url.port === '3000') {
      url.port = '';
    }
    
    // Ensure pathname
    if (!url.pathname || url.pathname === '') {
      url.pathname = '/';
    }
    
    return url.toString();
  } catch (error) {
    console.error('[Preview URL] Failed to normalize URL:', input, error);
    return input; // Return original if parsing fails
  }
}

/**
 * Get preview URL from E2B sandbox
 * Returns normalized URL without port
 */
export function getPreviewUrl(sandboxId: string): string {
  const rawUrl = `https://${sandboxId}.e2b.dev`;
  return normalizePreviewUrl(rawUrl);
}

/**
 * Validate preview URL format
 */
export function isValidPreviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('.e2b.dev') || 
       parsed.hostname.endsWith('.e2b-staging.dev'))
    );
  } catch {
    return false;
  }
}
