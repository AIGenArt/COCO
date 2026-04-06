// Core AI Governance Types for COCO

export type AICapability = 
  | 'ai:read_context'
  | 'ai:list_files'
  | 'ai:read_file'
  | 'ai:propose_patch'
  | 'ai:write_file'
  | 'ai:run_command'
  | 'ai:commit_changes'
  | 'ai:open_pr'
  | 'ai:read_logs'
  | 'ai:request_repo_sync';

export type AIRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AIPolicyMode = 
  | 'read_only'
  | 'propose_only'
  | 'apply_with_approval'
  | 'restricted_autonomy';

export type AIActionType =
  | 'read_file'
  | 'list_files'
  | 'write_file'
  | 'run_command'
  | 'commit_changes'
  | 'open_pr';

export type AIActionStatus =
  | 'proposed'
  | 'denied'
  | 'awaiting_approval'
  | 'approved'
  | 'executed'
  | 'failed';

export type AIActionRequest =
  | { type: 'read_file'; workspaceId: string; path: string }
  | { type: 'list_files'; workspaceId: string; path: string }
  | { type: 'write_file'; workspaceId: string; path: string; content: string }
  | { type: 'run_command'; workspaceId: string; command: string[]; env?: Record<string, string> }
  | { type: 'commit_changes'; workspaceId: string; message: string }
  | { type: 'open_pr'; workspaceId: string; title: string; body: string };

export type PolicyDecision =
  | { outcome: 'allow'; reason: string }
  | { outcome: 'deny'; reason: string }
  | { outcome: 'require_approval'; reason: string; approvalType: 'user' | 'admin' };

export interface WorkspaceAccessContext {
  workspaceId: string;
  userId: string;
  workspaceType: 'local' | 'github_repo';
  githubInstallationId: string | null;
  githubRepoAccessId: string | null;
  status: string;
}

export interface GitHubAccessContext {
  installationId: string;
  repoAccessId: string;
  repoFullName: string;
  active: boolean;
}

export interface AIAuditEvent {
  eventType: string;
  userId: string;
  workspaceId: string;
  actionType?: AIActionType;
  capability?: AICapability;
  risk?: AIRiskLevel;
  decision?: 'allow' | 'deny' | 'require_approval';
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AIActionResult {
  success: boolean;
  data?: any;
  error?: string;
  auditId?: string;
}

export interface AIPolicy {
  id: string;
  workspaceId: string;
  mode: AIPolicyMode;
  capabilities: AICapability[];
  restrictedPaths: string[];
  restrictedCommands: string[];
  maxTokensPerRequest: number;
  allowedModels: string[];
  requiresApprovalFor: string[];
}
