/**
 * POST /api/sandboxes
 * 
 * Create a new sandbox instance for a workspace.
 * Enforces: Max 1 active sandbox per workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SandboxManager } from '@/lib/sandbox/sandbox-manager';
import { SANDBOX_LIMITS } from '@/lib/sandbox/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // Get workspaceId from query params
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Verify workspace ownership
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, user_id')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    if (workspace.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this workspace' },
        { status: 403 }
      );
    }

    // Get active sandbox
    const activeSandbox = await SandboxManager.getActiveSandbox(workspaceId);

    return NextResponse.json({ sandbox: activeSandbox });

  } catch (error) {
    console.error('Error fetching active sandbox:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch sandbox' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Verify workspace ownership
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, user_id')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    if (workspace.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this workspace' },
        { status: 403 }
      );
    }

    // Double-check: Max 1 active sandbox per workspace (API-level check)
    const { data: existingSandboxes } = await supabase
      .from('sandbox_instances')
      .select('id, status')
      .eq('workspace_id', workspaceId)
      .in('status', ['creating', 'starting', 'running']);

    if (existingSandboxes && existingSandboxes.length >= SANDBOX_LIMITS.MAX_ACTIVE_PER_WORKSPACE) {
      return NextResponse.json(
        { 
          error: `Workspace already has ${SANDBOX_LIMITS.MAX_ACTIVE_PER_WORKSPACE} active sandbox(es). Stop existing sandbox first.`,
          existingSandboxes 
        },
        { status: 409 }
      );
    }

    // Create sandbox using SandboxManager
    const sandbox = await SandboxManager.createSandbox(workspaceId);

    return NextResponse.json(
      { 
        sandbox,
        message: 'Sandbox created successfully' 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating sandbox:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create sandbox' 
      },
      { status: 500 }
    );
  }
}
