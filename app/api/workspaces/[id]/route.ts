import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/workspaces/[id] - Get a single workspace
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Fetch workspace and verify ownership
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Update last_accessed_at (throttled - only if > 5 minutes since last update)
    const lastAccessed = workspace.last_accessed_at 
      ? new Date(workspace.last_accessed_at).getTime() 
      : 0;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - lastAccessed > fiveMinutes) {
      // Non-blocking update
      void supabase
        .from('workspaces')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Unexpected error in GET /api/workspaces/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/[id] - Partial update workspace metadata (for AutoSave)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Verify workspace exists and user owns it
    const { data: existingWorkspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingWorkspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Build update object (only include provided fields)
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Allow only valid fields from the request body
    if (body.name !== undefined) {
      updates.name = body.name;
    }
    if (body.description !== undefined) {
      updates.description = body.description;
    }
    if (body.template !== undefined) {
      // Validate template value
      const validTemplates = ['nextjs', 'react', 'vue', 'vanilla'];
      if (validTemplates.includes(body.template)) {
        updates.template = body.template;
      }
    }
    if (body.sandbox_id !== undefined) {
      // Allow clearing sandbox_id (set to null) or updating it
      updates.sandbox_id = body.sandbox_id;
    }

    // Update workspace
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workspace:', error);
      return NextResponse.json(
        { error: 'Failed to update workspace' },
        { status: 500 }
      );
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/workspaces/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/workspaces/[id] - Update workspace metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Verify workspace exists and user owns it
    const { data: existingWorkspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingWorkspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, description, template } = body;

    // Build update object (only include provided fields)
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'Invalid workspace name' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (template !== undefined) {
      updates.template = template;
    }

    // Update workspace
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workspace:', error);
      return NextResponse.json(
        { error: 'Failed to update workspace' },
        { status: 500 }
      );
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Unexpected error in PUT /api/workspaces/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id] - Delete workspace with controlled sequence
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Verify workspace exists and user owns it
    const { data: workspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Controlled delete sequence:
    
    // 1. Log deletion start
    await supabase
      .from('sandbox_events')
      .insert({
        workspace_id: id,
        event_type: 'workspace_deleted',
        severity: 'info',
        message: `Workspace "${workspace.name}" deletion started`,
        metadata: { user_id: user.id },
      });

    // 2. Check for active sandbox and stop it
    const { data: activeSandbox } = await supabase
      .from('sandbox_instances')
      .select('*')
      .eq('workspace_id', id)
      .eq('status', 'running')
      .single();

    if (activeSandbox) {
      try {
        // Update sandbox status to stopped
        await supabase
          .from('sandbox_instances')
          .update({
            status: 'stopped',
            stopped_at: new Date().toISOString(),
          })
          .eq('id', activeSandbox.id);

        // Log sandbox stop (non-blocking, fire-and-forget)
        void supabase
          .from('sandbox_events')
          .insert({
            workspace_id: id,
            sandbox_id: activeSandbox.id,
            event_type: 'sandbox_stopped',
            severity: 'info',
            message: 'Sandbox stopped before workspace deletion',
          });
      } catch (error) {
        console.error('Error stopping sandbox:', error);
        // Continue with deletion even if sandbox stop fails
      }
    }

    // 3. Delete workspace metadata (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting workspace:', deleteError);
      
      // Log failure (non-blocking, fire-and-forget)
      void supabase
        .from('sandbox_events')
        .insert({
          workspace_id: id,
          event_type: 'cleanup_ran',
          severity: 'error',
          message: 'Workspace deletion failed',
          metadata: { error: deleteError.message },
        });

      return NextResponse.json(
        { error: 'Failed to delete workspace' },
        { status: 500 }
      );
    }

    // 4. Log successful cleanup (non-blocking, fire-and-forget)
    void supabase
      .from('sandbox_events')
      .insert({
        workspace_id: id,
        event_type: 'cleanup_ran',
        severity: 'info',
        message: `Workspace "${workspace.name}" deleted successfully`,
        metadata: { user_id: user.id },
      });

    return NextResponse.json({ 
      success: true,
      message: 'Workspace deleted successfully' 
    });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/workspaces/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
