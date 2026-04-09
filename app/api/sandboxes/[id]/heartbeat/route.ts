/**
 * POST /api/sandboxes/[id]/heartbeat
 * 
 * Update sandbox heartbeat (last_seen_at).
 * Only works for running sandboxes.
 * Validates that sandbox is still the active one for its workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: sandboxId } = await params;

    // Get sandbox with workspace info
    const { data: sandbox, error: sandboxError } = await supabase
      .from('sandbox_instances')
      .select(`
        *,
        workspace:workspaces!inner(id, user_id, name)
      `)
      .eq('id', sandboxId)
      .single();

    if (sandboxError || !sandbox) {
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    // Verify ownership: sandbox → workspace → user
    if (sandbox.workspace.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this sandbox' },
        { status: 403 }
      );
    }

    // Verify sandbox is running
    if (sandbox.status !== 'running') {
      return NextResponse.json(
        { error: 'Sandbox must be running to send heartbeat' },
        { status: 400 }
      );
    }

    // Update heartbeat (validates sandbox is still active for workspace)
    await SandboxManager.updateHeartbeat(sandboxId, sandbox.workspace_id);

    return NextResponse.json({
      message: 'Heartbeat updated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating heartbeat:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update heartbeat' 
      },
      { status: 500 }
    );
  }
}
