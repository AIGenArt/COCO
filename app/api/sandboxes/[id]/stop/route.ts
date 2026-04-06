/**
 * POST /api/sandboxes/[id]/stop
 * 
 * Stop a running sandbox instance.
 * Transitions from 'running' to 'stopping'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const sandboxId = params.id;

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

    // Transition to 'stopping'
    try {
      const updatedSandbox = await SandboxManager.transitionStatus(
        sandboxId,
        'stopping'
      );

      return NextResponse.json({
        sandbox: updatedSandbox,
        message: 'Sandbox is stopping'
      });

    } catch (transitionError) {
      // Handle invalid state transition
      return NextResponse.json(
        { 
          error: transitionError instanceof Error 
            ? transitionError.message 
            : 'Failed to stop sandbox'
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error stopping sandbox:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to stop sandbox' 
      },
      { status: 500 }
    );
  }
}
