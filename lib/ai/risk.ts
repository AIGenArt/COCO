import { AIActionRequest, AIRiskLevel } from './types';

// Sensitive paths that should trigger high/critical risk
const SENSITIVE_PATHS = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'supabase/migrations',
  'lib/auth',
  'docs/rules.md',
  'docs/ai-governance.md',
  'lib/supabase',
  'app/api/auth',
  'middleware.ts',
  'next.config',
  'package.json',
  'tsconfig.json'
];

// Commands that are considered high risk
const HIGH_RISK_COMMANDS = [
  'rm -rf',
  'sudo',
  'curl',
  'wget',
  'nc',
  'netcat',
  'python -m http.server',
  'npm install',
  'yarn add',
  'pnpm add',
  'git push',
  'git reset --hard',
  'chmod',
  'chown'
];

export function classifyAIActionRisk(action: AIActionRequest): AIRiskLevel {
  switch (action.type) {
    case 'list_files':
      return 'low';
    
    case 'read_file':
      // Sæt C, Regel C3: Check for sensitive paths
      if (action.path && isSensitivePath(action.path)) {
        return 'critical';
      }
      return 'low';
    
    case 'write_file':
      if (action.path && isSensitivePath(action.path)) {
        return 'critical';
      }
      // Check if content contains secrets
      if (action.content && containsSuspiciousPatterns(action.content)) {
        return 'high';
      }
      return 'medium';
    
    case 'run_command':
      const commandStr = action.command.join(' ');
      if (isHighRiskCommand(commandStr)) {
        return 'critical';
      }
      return 'high';
    
    case 'commit_changes':
      return 'high';
    
    case 'open_pr':
      return 'medium';
    
    default:
      return 'medium';
  }
}

function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATHS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(path);
    }
    return path === pattern || path.startsWith(pattern + '/') || path.includes('/' + pattern);
  });
}

function isHighRiskCommand(command: string): boolean {
  return HIGH_RISK_COMMANDS.some(pattern => 
    command.toLowerCase().includes(pattern.toLowerCase())
  );
}

function containsSuspiciousPatterns(content: string): boolean {
  const suspiciousPatterns = [
    /api[_-]?key/i,
    /secret/i,
    /password/i,
    /token/i,
    /private[_-]?key/i
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(content));
}
