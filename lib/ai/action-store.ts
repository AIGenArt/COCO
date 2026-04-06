// In-memory action store for COCO
// This will be replaced with database persistence when Supabase is connected

import {
  AIActionRequest,
  AICapability,
  AIRiskLevel,
  PolicyDecision
} from './types';

export interface PlannedAction {
  id: string;
  userId: string;
  workspaceId: string;
  action: AIActionRequest;
  capability: AICapability;
  risk: AIRiskLevel;
  decision: PolicyDecision;
  status: 'planned' | 'awaiting_approval' | 'approved' | 'rejected' | 'executed' | 'failed';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  executedAt?: string;
  executionResult?: any;
  createdAt: string;
}

// In-memory store (will be replaced with database)
const actionStore = new Map<string, PlannedAction>();

export function createPlannedAction(data: {
  userId: string;
  workspaceId: string;
  action: AIActionRequest;
  capability: AICapability;
  risk: AIRiskLevel;
  decision: PolicyDecision;
}): PlannedAction {
  const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const plannedAction: PlannedAction = {
    id,
    userId: data.userId,
    workspaceId: data.workspaceId,
    action: data.action,
    capability: data.capability,
    risk: data.risk,
    decision: data.decision,
    status: data.decision.outcome === 'require_approval' ? 'awaiting_approval' : 'planned',
    createdAt: new Date().toISOString()
  };
  
  actionStore.set(id, plannedAction);
  
  return plannedAction;
}

export function getPlannedAction(id: string): PlannedAction | undefined {
  return actionStore.get(id);
}

export function updatePlannedAction(id: string, updates: Partial<PlannedAction>): PlannedAction | undefined {
  const action = actionStore.get(id);
  if (!action) return undefined;
  
  const updated = { ...action, ...updates };
  actionStore.set(id, updated);
  
  return updated;
}

export function deletePlannedAction(id: string): boolean {
  return actionStore.delete(id);
}

export function getUserActions(userId: string): PlannedAction[] {
  return Array.from(actionStore.values()).filter(action => action.userId === userId);
}

export function getWorkspaceActions(workspaceId: string): PlannedAction[] {
  return Array.from(actionStore.values()).filter(action => action.workspaceId === workspaceId);
}

// Cleanup old actions (older than 24 hours)
export function cleanupOldActions(): number {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let cleaned = 0;
  
  for (const [id, action] of Array.from(actionStore.entries())) {
    const createdAt = new Date(action.createdAt).getTime();
    if (createdAt < oneDayAgo) {
      actionStore.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}

// Run cleanup every hour
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupOldActions, 60 * 60 * 1000);
}
