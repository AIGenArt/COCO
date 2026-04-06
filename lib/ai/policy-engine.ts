import {
  PolicyDecision,
  WorkspaceAccessContext,
  GitHubAccessContext,
  AIActionRequest,
  AICapability,
  AIRiskLevel,
  AIPolicyMode,
  AIPolicy
} from './types';
import { getDefaultCapabilities } from './capabilities';

// Default restrictive policy (Sæt B, Regel B1: Standard er "read/propose only")
function getDefaultPolicy(workspaceId: string): AIPolicy {
  return {
    id: 'default',
    workspaceId,
    mode: 'propose_only',
    capabilities: getDefaultCapabilities('propose_only'),
    restrictedPaths: [
      '.env',
      '.env.*',
      'supabase/migrations/*',
      'lib/auth/*',
      'docs/rules.md',
      'docs/ai-governance.md',
      'lib/supabase/*',
      'app/api/auth/*',
      'middleware.ts',
      'next.config.*',
      'package.json'
    ],
    restrictedCommands: [
      'rm -rf',
      'sudo',
      'curl',
      'wget',
      'nc',
      'python -m http.server',
      'npm install',
      'yarn add',
      'pnpm add'
    ],
    maxTokensPerRequest: 4000,
    allowedModels: ['gpt-4', 'claude-3-sonnet'],
    requiresApprovalFor: [
      'write_file',
      'delete_file',
      'run_command',
      'git_operation'
    ]
  };
}

export async function evaluateAIAction(input: {
  userId: string;
  workspace: WorkspaceAccessContext;
  github: GitHubAccessContext | null;
  action: AIActionRequest;
  capability: AICapability;
  risk: AIRiskLevel;
}): Promise<PolicyDecision> {
  // For now, use default policy
  // TODO: Load from database when Supabase is connected
  const policy = getDefaultPolicy(input.workspace.workspaceId);
  
  // Regel P1-P4: Basic checks (already done in guards)
  
  // Regel P8: Critical risk → deny
  if (input.risk === 'critical') {
    return {
      outcome: 'deny',
      reason: 'Critical risk actions are not permitted'
    };
  }
  
  // Regel P5: Low risk with capability → allow
  if (input.risk === 'low') {
    return {
      outcome: 'allow',
      reason: 'Low risk action with valid capability'
    };
  }
  
  // Regel P7: High risk → require approval
  if (input.risk === 'high') {
    return {
      outcome: 'require_approval',
      reason: 'High risk action requires user approval',
      approvalType: 'user'
    };
  }
  
  // Regel P6: Medium risk depends on mode
  if (input.risk === 'medium') {
    if (policy.mode === 'read_only' || policy.mode === 'propose_only') {
      return {
        outcome: 'deny',
        reason: `Action not permitted in ${policy.mode} mode`
      };
    }
    
    if (policy.mode === 'apply_with_approval') {
      if (policy.requiresApprovalFor.includes(input.action.type)) {
        return {
          outcome: 'require_approval',
          reason: 'Action requires approval per policy',
          approvalType: 'user'
        };
      }
    }
    
    if (policy.mode === 'restricted_autonomy') {
      // Allow some medium-risk actions autonomously
      return {
        outcome: 'allow',
        reason: 'Permitted under restricted autonomy mode'
      };
    }
  }
  
  // Default: require approval
  return {
    outcome: 'require_approval',
    reason: 'Action requires approval',
    approvalType: 'user'
  };
}

export function getPolicy(workspaceId: string): AIPolicy {
  // For now, return default policy
  // TODO: Load from database when Supabase is connected
  return getDefaultPolicy(workspaceId);
}
