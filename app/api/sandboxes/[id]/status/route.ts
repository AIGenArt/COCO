import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sandboxes/[id]/status
 * Get sandbox status for polling
 */
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

    // Get sandbox instance
    const { data: sandbox, error } = await supabase
      .from('sandbox_instances')
      .select(`
        *,
        workspaces!inner(user_id)
      `)
      .eq('id', id)
      .single();

    if (error || !sandbox) {
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (sandbox.workspaces.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Return status
    return NextResponse.json({
      id: sandbox.id,
      status: sandbox.status,
      previewReady: sandbox.preview_ready,
      containerId: sandbox.container_id,
      port: sandbox.port,
      errorMessage: sandbox.error_message,
      startedAt: sandbox.started_at,
      lastSeenAt: sandbox.last_seen_at,
    });

  } catch (error) {
    console.error('Error getting sandbox status:', error);
    return NextResponse.json(
      { error: 'Failed to get sandbox status' },
      { status: 500 }
    );
  }
}
