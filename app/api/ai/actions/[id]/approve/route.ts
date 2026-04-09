import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/ai/guards';
import { assertWorkspaceAccess } from '@/lib/ai/guards';
import { getPlannedAction, updatePlannedAction } from '@/lib/ai/action-store';
import { auditApproval, auditSecurityEvent } from '@/lib/ai/audit';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Guard 1: Require user
    const user = await requireUser();
    
    // Parse request
    const body = await request.json();
    const { reason } = body;
    
    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Approval reason is required' 
        },
        { status: 400 }
      );
    }
    
    // Get planned action
    const { id: actionId } = await params;
    const plannedAction = getPlannedAction(actionId);
    
    if (!plannedAction) {
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
    
    // Verify action status
    if (plannedAction.status !== 'awaiting_approval') {
      return NextResponse.json(
        { 
          success: false,
          error: `Action cannot be approved. Current status: ${plannedAction.status}` 
        },
        { status: 409 }
      );
    }
    
    // Update action status
    const updatedAction = updatePlannedAction(actionId, {
      status: 'approved',
      approvedBy: user.id,
      approvedAt: new Date().toISOString()
    });
    
    if (!updatedAction) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to update action' 
        },
        { status: 500 }
      );
    }
    
    // Audit approval
    await auditApproval({
      aiRunId: actionId,
      userId: user.id,
      status: 'approved',
      reason,
      actions: [updatedAction.action]
    });
    
    return NextResponse.json({
      success: true,
      data: {
        actionId: updatedAction.id,
        status: updatedAction.status,
        approvedBy: updatedAction.approvedBy,
        approvedAt: updatedAction.approvedAt
      }
    });
    
  } catch (error) {
    console.error('[API] Approve action error:', error);
    
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

// Reject endpoint
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Guard 1: Require user
    const user = await requireUser();
    
    // Parse request
    const body = await request.json();
    const { reason } = body;
    
    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Rejection reason is required' 
        },
        { status: 400 }
      );
    }
    
    // Get planned action
    const { id: actionId } = await params;
    const plannedAction = getPlannedAction(actionId);
    
    if (!plannedAction) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Action not found' 
        },
        { status: 404 }
      );
    }
    
    // Verify user owns the workspace
    await assertWorkspaceAccess(plannedAction.workspaceId, user.id);
    
    // Verify action status
    if (plannedAction.status !== 'awaiting_approval') {
      return NextResponse.json(
        { 
          success: false,
          error: `Action cannot be rejected. Current status: ${plannedAction.status}` 
        },
        { status: 409 }
      );
    }
    
    // Update action status
    const updatedAction = updatePlannedAction(actionId, {
      status: 'rejected',
      rejectedBy: user.id,
      rejectedAt: new Date().toISOString()
    });
    
    if (!updatedAction) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to update action' 
        },
        { status: 500 }
      );
    }
    
    // Audit rejection
    await auditApproval({
      aiRunId: actionId,
      userId: user.id,
      status: 'rejected',
      reason,
      actions: [updatedAction.action]
    });
    
    return NextResponse.json({
      success: true,
      data: {
        actionId: updatedAction.id,
        status: updatedAction.status,
        rejectedBy: updatedAction.rejectedBy,
        rejectedAt: updatedAction.rejectedAt
      }
    });
    
  } catch (error) {
    console.error('[API] Reject action error:', error);
    
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
