import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SandboxManager } from '@/lib/sandbox/sandbox-manager';
import { E2BManager } from '@/lib/sandbox/e2b-manager';
import { bootstrapWorkspace } from '@/lib/sandbox/ai-workspace-bootstrap';
import { reconcileSandbox } from '@/lib/sandbox/sandbox-reconciliation';
import { normalizePreviewUrl } from '@/lib/sandbox/preview-url';
import { verifySandboxReusable } from '@/lib/sandbox/sandbox-verification';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sandboxes/create
 * Create e2b sandbox with Next.js workspace
 */
export async function POST(request: NextRequest) {
  console.log('[API] ========================================');
  console.log('[API] POST /api/sandboxes/create called');
  console.log('[API] Timestamp:', new Date().toISOString());
  
  try {
    console.log('[API] Step 1: Creating Supabase client...');
    const supabase = await createClient();
    console.log('[API] ✓ Supabase client created');
    
    // Check authentication
    console.log('[API] Step 2: Checking authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[API] ✗ Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized', details: authError.message },
        { status: 401 }
      );
    }
    
    if (!user) {
      console.error('[API] ✗ No user found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[API] ✓ User authenticated:', user.id);

    // Parse request body
    console.log('[API] Step 3: Parsing request body...');
    const body = await request.json();
    const { workspaceId } = body;
    console.log('[API] ✓ Request body parsed, workspaceId:', workspaceId);

    if (!workspaceId || typeof workspaceId !== 'string') {
      console.error('[API] ✗ Invalid workspaceId:', workspaceId);
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // Verify workspace ownership
    console.log('[API] Step 4: Verifying workspace ownership...');
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (workspaceError) {
      console.error('[API] ✗ Workspace query error:', workspaceError);
      return NextResponse.json(
        { error: 'Workspace not found or access denied', details: workspaceError.message },
        { status: 404 }
      );
    }
    
    if (!workspace) {
      console.error('[API] ✗ Workspace not found');
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }
    
    console.log('[API] ✓ Workspace verified:', workspace.id);

    // Check for existing active sandboxes (VERIFIED IDEMPOTENCY)
    console.log('[API] Step 5: Checking for existing sandboxes...');
    const { data: existingSandboxes, error: sandboxCheckError } = await supabase
      .from('sandbox_instances')
      .select('id, workspace_id, container_id, status, preview_ready, port, error_message')
      .eq('workspace_id', workspaceId)
      .in('status', ['creating', 'starting', 'running']);

    if (sandboxCheckError) {
      console.error('[API] ✗ Error checking existing sandboxes:', sandboxCheckError);
    } else {
      console.log('[API] ✓ Existing sandboxes check complete:', existingSandboxes?.length || 0, 'found');
    }

    if (existingSandboxes && existingSandboxes.length > 0) {
      const existingSandbox = existingSandboxes[0];
      console.log(`[Sandbox Create] Found existing sandbox: ${existingSandbox.id}`);
      console.log(`[Sandbox Create] Status: ${existingSandbox.status}, Preview Ready: ${existingSandbox.preview_ready}`);
      
      // VERIFIED IDEMPOTENCY: Only reuse if sandbox passes ALL verification checks
      console.log('[Sandbox Create] Running verification checks...');
      const verification = await verifySandboxReusable(existingSandbox);
      
      if (verification.reusable) {
        // Sandbox is verified healthy and reusable
        console.log('[Sandbox Create] ✓ Sandbox verified reusable - returning existing sandbox');
        
        const reconnectUrl = normalizePreviewUrl(`https://${existingSandbox.container_id}.e2b.dev`);
        
        return NextResponse.json({
          success: true,
          sandbox: {
            id: existingSandbox.id,
            containerId: existingSandbox.container_id,
            url: reconnectUrl,
            port: existingSandbox.port,
            status: existingSandbox.status,
          },
          reconnected: true,
          verified: true,
        }, { status: 200 });
      } else {
        // Sandbox failed verification - mark as terminated and create new
        console.log('[Sandbox Create] ✗ Sandbox verification failed:', verification.reason);
        console.log('[Sandbox Create] Marking sandbox as terminated and creating new one...');
        
        if (verification.shouldTerminate) {
          // Mark sandbox as failed (not terminated - that's not a valid status)
          await supabase
            .from('sandbox_instances')
            .update({ 
              status: 'failed',
              preview_ready: false,
              error_message: `Verification failed: ${verification.reason}`
            })
            .eq('id', existingSandbox.id);
          
          // Clear workspace reference
          await supabase
            .from('workspaces')
            .update({ sandbox_id: null })
            .eq('id', workspaceId);
          
          console.log('[Sandbox Create] ✓ Cleaned up failed sandbox, will create new one');
        }
        
        // Continue to create new sandbox below
      }
    }

    console.log('[API] Step 6: Creating new sandbox...');
    console.log('[API] E2B_API_KEY exists:', !!process.env.E2B_API_KEY);
    console.log('[API] E2B_API_KEY length:', process.env.E2B_API_KEY?.length || 0);
    
    // Create sandbox instance in database
    console.log('[API] Step 6a: Creating database record...');
    const sandboxInstance = await SandboxManager.createSandbox(workspaceId);
    console.log('[API] ✓ Database record created:', sandboxInstance.id);

    try {
      // Transition to starting
      console.log('[API] Step 6b: Transitioning status to starting...');
      await SandboxManager.transitionStatus(sandboxInstance.id, 'starting');
      console.log('[API] ✓ Status transitioned to starting');

      // Create e2b sandbox
      console.log('[API] Step 6c: Calling E2BManager.createSandbox...');
      console.log('[API] This will call E2B API to create sandbox...');
      
      let e2bSandbox;
      try {
        e2bSandbox = await E2BManager.createSandbox(workspaceId);
        console.log('[API] ✓ E2B Sandbox created successfully!');
        console.log('[API] E2B Sandbox ID:', e2bSandbox.id);
        console.log('[API] E2B Sandbox URL:', e2bSandbox.url);
      } catch (e2bError) {
        console.error('[API] ✗ E2BManager.createSandbox failed!');
        console.error('[API] Error type:', e2bError?.constructor?.name);
        console.error('[API] Error message:', e2bError instanceof Error ? e2bError.message : String(e2bError));
        console.error('[API] Error stack:', e2bError instanceof Error ? e2bError.stack : 'No stack trace');
        throw e2bError;
      }

      // Update sandbox with container info
      await supabase
        .from('sandbox_instances')
        .update({
          container_id: e2bSandbox.id,
          port: 3000,
        })
        .eq('id', sandboxInstance.id);

      // CRITICAL: Link workspace to sandbox BEFORE npm install
      await supabase
        .from('workspaces')
        .update({
          sandbox_id: sandboxInstance.id,
        })
        .eq('id', workspaceId);

      console.log('[Sandbox Create] Linked workspace to sandbox');

      // Start dev server with template bootstrap
      console.log('[Sandbox Create] ========================================');
      console.log('[Sandbox Create] Starting dev server with template bootstrap...');
      console.log('[Sandbox Create] ========================================');
      
      await E2BManager.startDevServer(e2bSandbox.id, 3000, (progress) => {
        console.log(`[Sandbox Create] Progress: ${progress.status} - ${progress.message}`);
      });

      console.log('[Sandbox Create] ✓ Dev server started and health check passed!');

      // Transition to running
      console.log('[Sandbox Create] Marking sandbox as running...');
      await SandboxManager.transitionStatus(sandboxInstance.id, 'running');
      await SandboxManager.markPreviewReady(sandboxInstance.id);

      console.log(`[Sandbox Create] ========================================`);
      console.log(`[Sandbox Create] ✓ Sandbox ${sandboxInstance.id} is ready!`);
      console.log(`[Sandbox Create] ========================================`);

      // Normalize preview URL before returning
      const normalizedUrl = normalizePreviewUrl(e2bSandbox.url);
      console.log('[Sandbox Create] Raw URL:', e2bSandbox.url);
      console.log('[Sandbox Create] Normalized URL:', normalizedUrl);

      return NextResponse.json({
        success: true,
        sandbox: {
          id: sandboxInstance.id,
          containerId: e2bSandbox.id,
          url: normalizedUrl,
          port: 3000,
          status: 'running',
        },
      }, { status: 200 });

    } catch (error) {
      console.error('[Sandbox Create] Error during sandbox creation:', error);
      
      // Mark as failed
      await SandboxManager.transitionStatus(
        sandboxInstance.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Cleanup e2b sandbox if it was created
      if (E2BManager.hasSandbox(workspaceId)) {
        await E2BManager.destroySandbox(workspaceId);
      }

      throw error;
    }

  } catch (error) {
    console.error('[API] ========================================');
    console.error('[API] ✗✗✗ FATAL ERROR ✗✗✗');
    console.error('[API] Error type:', error?.constructor?.name);
    console.error('[API] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[API] ========================================');
    
    return NextResponse.json(
      { 
        error: 'Failed to create sandbox',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error?.constructor?.name,
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
