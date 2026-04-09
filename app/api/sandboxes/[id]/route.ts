/**
 * GET /api/sandboxes/[id]
 * 
 * Get sandbox status and details.
 * Verifies ownership through workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
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

    return NextResponse.json({ sandbox });

  } catch (error) {
    console.error('Error fetching sandbox:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch sandbox' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sandboxes/[id]
 * 
 * Destroy a sandbox and clean up resources.
 * Useful for cleaning up failed sandboxes.
 */
export async function DELETE(
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
    
    // Check if we should also delete the workspace
    const { searchParams } = new URL(request.url);
    const deleteWorkspace = searchParams.get('deleteWorkspace') === 'true';

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

    // Verify ownership
    if (sandbox.workspace.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this sandbox' },
        { status: 403 }
      );
    }

    console.log(`[API] Destroying sandbox ${sandboxId}...`);
    console.log(`[API] Current status: ${sandbox.status}`);

    // Only transition if not already destroyed
    if (sandbox.status !== 'destroyed') {
      // State machine requires: failed → destroying → destroyed
      // First transition to destroying
      const { error: destroyingError } = await supabase
        .from('sandbox_instances')
        .update({
          status: 'destroying',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sandboxId);

      if (destroyingError) {
        console.error('[API] Failed to transition to destroying:', destroyingError);
        return NextResponse.json(
          { error: 'Failed to destroy sandbox: ' + destroyingError.message },
          { status: 500 }
        );
      }

      // Then transition to destroyed
      const { error: destroyedError } = await supabase
        .from('sandbox_instances')
        .update({
          status: 'destroyed',
          stopped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sandboxId);

      if (destroyedError) {
        console.error('[API] Failed to transition to destroyed:', destroyedError);
        return NextResponse.json(
          { error: 'Failed to destroy sandbox: ' + destroyedError.message },
          { status: 500 }
        );
      }
    } else {
      console.log(`[API] Sandbox already destroyed, skipping state transitions`);
    }

    // Clear workspace reference or delete workspace entirely
    if (deleteWorkspace) {
      console.log(`[API] Deleting workspace ${sandbox.workspace_id}...`);
      const { error: deleteError } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', sandbox.workspace_id);
      
      if (deleteError) {
        console.error('[API] Failed to delete workspace:', deleteError);
        // Don't fail the whole operation, just log it
      } else {
        console.log(`[API] ✓ Workspace ${sandbox.workspace_id} deleted`);
      }
    } else {
      await supabase
        .from('workspaces')
        .update({ sandbox_id: null })
        .eq('id', sandbox.workspace_id);
    }

    console.log(`[API] ✓ Sandbox ${sandboxId} destroyed`);

    return NextResponse.json({
      success: true,
      message: deleteWorkspace 
        ? 'Sandbox destroyed and workspace deleted successfully'
        : 'Sandbox destroyed successfully',
    });

  } catch (error) {
    console.error('[API] Error destroying sandbox:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to destroy sandbox' 
      },
      { status: 500 }
    );
  }
}
