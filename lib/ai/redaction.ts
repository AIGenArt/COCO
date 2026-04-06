// Secret detection and redaction for COCO
// Implements Sæt C, Regel C1: No secrets in prompts, logs, or output

const SECRET_PATTERNS = [
  // Generic patterns
  /api[_-]?key[_-]?[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
  /secret[_-]?[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
  /password[_-]?[:=]\s*['"]?([a-zA-Z0-9_\-!@#$%^&*]{8,})['"]?/gi,
  /token[_-]?[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
  /bearer\s+([a-zA-Z0-9_\-\.]{20,})/gi,
  /authorization:\s*['"]?([a-zA-Z0-9_\-\.]{20,})['"]?/gi,
  
  // Specific service patterns
  /sk-[a-zA-Z0-9]{32,}/g,                    // OpenAI keys
  /ghp_[a-zA-Z0-9]{36}/g,                    // GitHub personal access tokens
  /gho_[a-zA-Z0-9]{36}/g,                    // GitHub OAuth tokens
  /ghs_[a-zA-Z0-9]{36}/g,                    // GitHub server tokens
  /AKIA[0-9A-Z]{16}/g,                       // AWS access keys
  /AIza[0-9A-Za-z\-_]{35}/g,                 // Google API keys
  /ya29\.[0-9A-Za-z\-_]+/g,                  // Google OAuth tokens
  /sk_live_[0-9a-zA-Z]{24,}/g,               // Stripe live keys
  /sk_test_[0-9a-zA-Z]{24,}/g,               // Stripe test keys
  /rk_live_[0-9a-zA-Z]{24,}/g,               // Stripe restricted keys
  /sq0atp-[0-9A-Za-z\-_]{22}/g,              // Square access tokens
  /sq0csp-[0-9A-Za-z\-_]{43}/g,              // Square OAuth secrets
  /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/g, // PayPal tokens
  /amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, // Amazon MWS
  /-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----/g, // Private keys
  /-----BEGIN OPENSSH PRIVATE KEY-----/g,    // SSH private keys
];

export function detectSecrets(content: string): string[] {
  const found: string[] = [];
  
  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      found.push(...matches);
    }
  }
  
  return Array.from(new Set(found)); // Remove duplicates
}

export function redactSecrets(content: string): string {
  let redacted = content;
  
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  
  return redacted;
}

export function hasSecrets(content: string): boolean {
  return SECRET_PATTERNS.some(pattern => pattern.test(content));
}

// Redact secrets from objects (for logging)
export function redactObject(obj: any): any {
  if (typeof obj === 'string') {
    return redactSecrets(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Redact common secret field names
      if (/^(password|secret|token|key|auth|credential|private)/i.test(key)) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactObject(value);
      }
    }
    return redacted;
  }
  
  return obj;
}
