/**
 * POST /api/sandboxes/[id]/mark-ready
 * 
 * Mark sandbox preview as ready.
 * Only after healthcheck passes.
 * Server-controlled - validates sandbox is actually healthy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

/**
 * Perform healthcheck on sandbox preview
 * Verifies that the preview port is responding with HTTP 200
 */
async function performHealthcheck(port: number): Promise<boolean> {
  try {
    // Construct preview URL (localhost for now, will be container URL in production)
    const previewUrl = `http://localhost:${port}`;
    
    console.log(`Performing healthcheck on ${previewUrl}`);
    
    // Attempt to fetch from preview endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(previewUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'COCO-Healthcheck/1.0',
      },
    });
    
    clearTimeout(timeoutId);
    
    // Check if response is OK (200-299)
    if (response.ok) {
      console.log(`Healthcheck passed for port ${port}`);
      return true;
    }
    
    console.warn(`Healthcheck failed for port ${port}: HTTP ${response.status}`);
    return false;
    
  } catch (error) {
    console.error(`Healthcheck error for port ${port}:`, error);
    return false;
  }
}

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

    // Verify sandbox is running
    if (sandbox.status !== 'running') {
      return NextResponse.json(
        { error: 'Sandbox must be running to mark preview ready' },
        { status: 400 }
      );
    }

    // Verify sandbox has a port assigned
    if (!sandbox.port) {
      return NextResponse.json(
        { error: 'Sandbox port not assigned yet' },
        { status: 400 }
      );
    }

    // Perform actual healthcheck
    const isHealthy = await performHealthcheck(sandbox.port);
    
    if (!isHealthy) {
      return NextResponse.json(
        { error: 'Healthcheck failed - preview not ready' },
        { status: 503 }
      );
    }

    // Mark preview as ready
    await SandboxManager.markPreviewReady(sandboxId);

    return NextResponse.json({
      message: 'Preview marked as ready',
      sandbox: {
        id: sandboxId,
        preview_ready: true
      }
    });

  } catch (error) {
    console.error('Error marking preview ready:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to mark preview ready' 
      },
      { status: 500 }
    );
  }
}
