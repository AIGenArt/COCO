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
import { dispatchAIAction } from '@/lib/ai/dispatcher';
import { auditAIEvent, auditExecution, auditSecurityEvent } from '@/lib/ai/audit';
import { getPlannedAction, updatePlannedAction } from '@/lib/ai/action-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Guard 1: Require user
    const user = await requireUser();
    
    // Parse request - ONLY accepts action IDs, never raw payloads
    const body = await request.json();
    const { actionId } = body;
    
    if (!actionId || typeof actionId !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Action ID is required. Raw action payloads are not accepted.' 
        },
        { status: 400 }
      );
    }
    
    // Load planned action by ID
    const plannedAction = getPlannedAction(actionId);
    
    if (!plannedAction) {
      await auditSecurityEvent({
        userId: user.id,
        workspaceId: 'unknown',
        eventType: 'execute_unknown_action',
        severity: 'high',
        details: { actionId }
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Action not found' 
        },
        { status: 404 }
      );
    }
    
    // Verify user owns the workspace
    const workspace = await assertWorkspaceAccess(plannedAction.workspaceId, user.id);
    
    // Verify action hasn't been executed already
    if (plannedAction.status === 'executed') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Action has already been executed' 
        },
        { status: 409 }
      );
    }
    
    // Verify action hasn't been rejected
    if (plannedAction.status === 'rejected') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Action was rejected and cannot be executed' 
        },
        { status: 403 }
      );
    }
    
    // CRITICAL: Re-run guard chain (policy might have changed!)
    const github = await assertGitHubRepoAccessIfNeeded(workspace, user.id);
    const capability = getRequiredCapability(plannedAction.action.type);
    await assertAICapability(user.id, workspace.workspaceId, capability);
    
    // Re-classify risk (file might have become sensitive)
    const currentRisk = classifyAIActionRisk(plannedAction.action);
    
    // Re-evaluate policy
    const currentDecision = await evaluateAIAction({
      userId: user.id,
      workspace,
      github,
      action: plannedAction.action,
      capability,
      risk: currentRisk
    });
    
    // Check if decision changed
    if (currentDecision.outcome === 'deny') {
      await auditSecurityEvent({
        userId: user.id,
        workspaceId: workspace.workspaceId,
        eventType: 'policy_changed_to_deny',
        severity: 'high',
        details: {
          actionId,
          originalDecision: plannedAction.decision.outcome,
          currentDecision: currentDecision.outcome,
          reason: currentDecision.reason
        }
      });
      
      // Update action status
      updatePlannedAction(actionId, {
        status: 'failed'
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: `Policy changed: ${currentDecision.reason}` 
        },
        { status: 403 }
      );
    }
    
    // If approval is required, verify it exists
    if (currentDecision.outcome === 'require_approval') {
      if (plannedAction.status !== 'approved') {
        return NextResponse.json(
          { 
            success: false,
            error: 'Action requires approval before execution' 
          },
          { status: 403 }
        );
      }
      
      // Verify approval is from the right user
      if (plannedAction.approvedBy !== user.id) {
        await auditSecurityEvent({
          userId: user.id,
          workspaceId: workspace.workspaceId,
          eventType: 'execute_without_own_approval',
          severity: 'medium',
          details: {
            actionId,
            approvedBy: plannedAction.approvedBy
          }
        });
      }
    }
    
    // Execute action through dispatcher
    const result = await dispatchAIAction(
      user.id,
      workspace,
      plannedAction.action
    );
    
    // Update action status
    updatePlannedAction(actionId, {
      status: result.success ? 'executed' : 'failed',
      executedAt: new Date().toISOString(),
      executionResult: result
    });
    
    // Audit execution
    await auditExecution(actionId, result);
    
    await auditAIEvent({
      eventType: result.success ? 'ai_action_executed' : 'ai_action_failed',
      userId: user.id,
      workspaceId: workspace.workspaceId,
      actionType: plannedAction.action.type,
      capability,
      risk: currentRisk,
      decision: 'allow',
      metadata: {
        actionId,
        success: result.success,
        error: result.error
      }
    });
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('[API] Execute action error:', error);
    
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
