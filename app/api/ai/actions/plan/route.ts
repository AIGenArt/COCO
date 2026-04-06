import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/ai/guards';
import {
  assertWorkspaceAccess,
  assertGitHubRepoAccessIfNeeded,
  assertAICapability
} from '@/lib/ai/guards';
import { getRequiredCapability } from '@/lib/ai/capabilities';
import { classifyAIActionRisk } from '@/lib/ai/risk';
import { evaluateAIAction } from '@/lib/ai/policy-engine';
import { auditAIEvent } from '@/lib/ai/audit';
import { createPlannedAction } from '@/lib/ai/action-store';
import { AIActionRequest } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Guard 1: Require user
    const user = await requireUser();
    
    // Parse request
    const body = await request.json();
    const action: AIActionRequest = body.action;
    
    if (!action || !action.workspaceId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid action request. Missing action or workspaceId.' 
        },
        { status: 400 }
      );
    }
    
    // Validate action type
    const validTypes = ['read_file', 'list_files', 'write_file', 'run_command', 'commit_changes', 'open_pr'];
    if (!validTypes.includes(action.type)) {
      return NextResponse.json(
        { 
          success: false,
          error: `Invalid action type: ${action.type}` 
        },
        { status: 400 }
      );
    }
    
    // Guard 2: Assert workspace access
    const workspace = await assertWorkspaceAccess(action.workspaceId, user.id);
    
    // Guard 3: Assert GitHub access if needed
    const github = await assertGitHubRepoAccessIfNeeded(workspace, user.id);
    
    // Guard 4: Assert capability
    const capability = getRequiredCapability(action.type);
    await assertAICapability(user.id, workspace.workspaceId, capability);
    
    // Classify risk
    const risk = classifyAIActionRisk(action);
    
    // Evaluate policy
    const decision = await evaluateAIAction({
      userId: user.id,
      workspace,
      github,
      action,
      capability,
      risk
    });
    
    // Create planned action
    const plannedAction = createPlannedAction({
      userId: user.id,
      workspaceId: workspace.workspaceId,
      action,
      capability,
      risk,
      decision
    });
    
    // Audit
    await auditAIEvent({
      eventType: 'ai_action_planned',
      userId: user.id,
      workspaceId: workspace.workspaceId,
      actionType: action.type,
      capability,
      risk,
      decision: decision.outcome,
      reason: decision.reason,
      metadata: {
        actionId: plannedAction.id,
        requiresApproval: decision.outcome === 'require_approval'
      }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        actionId: plannedAction.id,
        action: plannedAction.action,
        capability: plannedAction.capability,
        risk: plannedAction.risk,
        decision: plannedAction.decision,
        status: plannedAction.status,
        requiresApproval: decision.outcome === 'require_approval',
        createdAt: plannedAction.createdAt
      }
    });
    
  } catch (error) {
    console.error('[API] Plan action error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('not found') || errorMessage.includes('access denied') ? 403 : 500;
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
      { status: statusCode }
    );
  }
}
