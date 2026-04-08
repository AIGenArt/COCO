import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SandboxManager } from '@/lib/sandbox/sandbox-manager';
import { E2BManager } from '@/lib/sandbox/e2b-manager';
import { normalizePreviewUrl } from '@/lib/sandbox/preview-url';
import { checkPreviewHealth } from '@/lib/sandbox/preview-health';
import { replaceSandbox, getActiveSandbox } from '@/lib/sandbox/lifecycle-service';
import { validateWorkspaceStructure } from '@/lib/sandbox/bootstrap-service';
import type { SandboxFilesystem } from '@/lib/sandbox/bootstrap-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sandboxes/create
 * 
 * Phase 3: Complete lifecycle flow
 * - Bootstrap & validation
 * - Dev server start
 * - Health check
 * - Mark ready
 * - Atomic activation
 */
export async function POST(request: NextRequest) {
  console.log('[Create] ========================================');
  console.log('[Create] POST /api/sandboxes/create');
  console.log('[Create] Timestamp:', new Date().toISOString());
  console.log('[Create] ========================================');
  
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[Create] ✗ Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[Create] ✓ User authenticated:', user.id);

    // Parse request body
    const body = await request.json();
    const { workspaceId } = body;

    if (!workspaceId || typeof workspaceId !== 'string') {
      console.error('[Create] ✗ Invalid workspaceId');
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    console.log('[Create] Workspace ID:', workspaceId);

    // Verify workspace ownership
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (workspaceError || !workspace) {
      console.error('[Create] ✗ Workspace not found or access denied');
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }
    
    console.log('[Create] ✓ Workspace verified');

    // Check for existing active sandbox
    console.log('[Create] Checking for existing active sandbox...');
    const existingActiveSandbox = await getActiveSandbox(workspaceId);
    
    if (existingActiveSandbox) {
      console.log('[Create] Found existing active sandbox:', existingActiveSandbox.id);
      console.log('[Create] Status:', existingActiveSandbox.status);
      console.log('[Create] Preview ready:', existingActiveSandbox.preview_ready);
      
      // If existing sandbox is ready, return it
      if (existingActiveSandbox.status === 'ready' && existingActiveSandbox.preview_ready) {
        console.log('[Create] ✓ Existing sandbox is ready, returning it');
        
        const previewUrl = existingActiveSandbox.preview_url 
          ? normalizePreviewUrl(existingActiveSandbox.preview_url)
          : null;
        
        return NextResponse.json({
          success: true,
          sandbox: {
            id: existingActiveSandbox.id,
            containerId: existingActiveSandbox.container_id,
            url: previewUrl,
            port: existingActiveSandbox.port,
            status: existingActiveSandbox.status,
          },
          reconnected: true,
        }, { status: 200 });
      }
      
      // If existing sandbox is not ready, it will be replaced by new one
      console.log('[Create] Existing sandbox not ready, will create new one');
    }

    // ========================================
    // PHASE 3: Complete Lifecycle Flow
    // ========================================

    console.log('[Create] ========================================');
    console.log('[Create] Starting Phase 3 lifecycle flow');
    console.log('[Create] ========================================');

    // Step 1: Create E2B sandbox (status: creating)
    console.log('[Create] Step 1: Creating E2B sandbox...');
    const sandboxInstance = await SandboxManager.createSandbox(workspaceId);
    console.log('[Create] ✓ Database record created:', sandboxInstance.id);
    console.log('[Create] Status: creating');

    try {
      // Step 2: Create provider sandbox
      console.log('[Create] Step 2: Creating provider sandbox...');
      const e2bSandbox = await E2BManager.createSandbox(workspaceId);
      console.log('[Create] ✓ E2B sandbox created:', e2bSandbox.id);

      // Update with container ID
      await supabase
        .from('sandbox_instances')
        .update({ container_id: e2bSandbox.id })
        .eq('id', sandboxInstance.id);

      // Step 3: Bootstrap (status: bootstrapping)
      console.log('[Create] Step 3: Bootstrapping workspace...');
      await SandboxManager.transitionStatus(sandboxInstance.id, 'bootstrapping');
      
      // Create filesystem interface for validation
      const fs: SandboxFilesystem = {
        exists: async (path: string) => {
          try {
            await e2bSandbox.sandbox.files.read(path);
            return true;
          } catch {
            return false;
          }
        },
        readFile: async (path: string) => {
          return await e2bSandbox.sandbox.files.read(path);
        },
        writeFile: async (path: string, content: string) => {
          await e2bSandbox.sandbox.files.write(path, content);
        },
      };

      // Validate workspace structure
      console.log('[Create] Step 4: Validating workspace structure...');
      const validation = await validateWorkspaceStructure(fs);
      
      if (!validation.ok) {
        console.error('[Create] ✗ Validation failed');
        console.error('[Create] Missing files:', validation.missing);
        console.error('[Create] Details:', validation.details);
        
        await SandboxManager.transitionStatus(
          sandboxInstance.id,
          'failed',
          `Validation failed: ${validation.details?.join(', ') || 'Unknown error'}`
        );
        
        // Cleanup
        await E2BManager.destroySandbox(workspaceId);
        
        return NextResponse.json({
          error: 'Workspace validation failed',
          details: validation.details,
          missing: validation.missing,
        }, { status: 400 });
      }
      
      console.log('[Create] ✓ Validation passed');

      // Step 5: Start dev server (status: starting)
      console.log('[Create] Step 5: Starting dev server...');
      await SandboxManager.transitionStatus(sandboxInstance.id, 'starting');
      
      await E2BManager.startDevServer(e2bSandbox.id, 3000, (progress) => {
        console.log(`[Create] Dev server progress: ${progress.status} - ${progress.message}`);
      });
      
      console.log('[Create] ✓ Dev server started');

      // Step 6: Mark running and set preview URL
      console.log('[Create] Step 6: Marking as running...');
      const previewUrl = normalizePreviewUrl(`https://${e2bSandbox.id}.e2b.dev`);
      
      await supabase
        .from('sandbox_instances')
        .update({
          status: 'running',
          port: 3000,
          preview_url: previewUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sandboxInstance.id);
      
      console.log('[Create] ✓ Status: running');
      console.log('[Create] Preview URL:', previewUrl);

      // Step 7: Health check
      console.log('[Create] Step 7: Running health check...');
      const health = await checkPreviewHealth(previewUrl, 10000);
      
      if (health.status !== 'ready') {
        console.error('[Create] ✗ Health check failed');
        console.error('[Create] Error:', health.error);
        
        await SandboxManager.transitionStatus(
          sandboxInstance.id,
          'failed',
          `Health check failed: ${health.error}`
        );
        
        // Cleanup
        await E2BManager.destroySandbox(workspaceId);
        
        return NextResponse.json({
          error: 'Preview health check failed',
          details: health.error,
        }, { status: 500 });
      }
      
      console.log('[Create] ✓ Health check passed');

      // Step 8: Mark ready
      console.log('[Create] Step 8: Marking as ready...');
      await supabase
        .from('sandbox_instances')
        .update({
          status: 'ready',
          preview_ready: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sandboxInstance.id);
      
      console.log('[Create] ✓ Status: ready, preview_ready: true');

      // Step 9: Activate (atomic replacement)
      console.log('[Create] Step 9: Activating sandbox...');
      await replaceSandbox({
        workspaceId,
        newSandboxId: sandboxInstance.id,
        reason: 'Activated verified ready sandbox',
      });
      
      console.log('[Create] ✓ Sandbox activated as workspace.active_sandbox_id');

      console.log('[Create] ========================================');
      console.log('[Create] ✓✓✓ SANDBOX READY ✓✓✓');
      console.log('[Create] Sandbox ID:', sandboxInstance.id);
      console.log('[Create] Container ID:', e2bSandbox.id);
      console.log('[Create] Preview URL:', previewUrl);
      console.log('[Create] ========================================');

      return NextResponse.json({
        success: true,
        sandbox: {
          id: sandboxInstance.id,
          containerId: e2bSandbox.id,
          url: previewUrl,
          port: 3000,
          status: 'ready',
        },
      }, { status: 200 });

    } catch (error) {
      console.error('[Create] ========================================');
      console.error('[Create] ✗✗✗ ERROR DURING CREATION ✗✗✗');
      console.error('[Create] Error:', error);
      console.error('[Create] ========================================');
      
      // Mark as failed
      await SandboxManager.transitionStatus(
        sandboxInstance.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Cleanup E2B sandbox if it was created
      if (E2BManager.hasSandbox(workspaceId)) {
        try {
          await E2BManager.destroySandbox(workspaceId);
          console.log('[Create] ✓ Cleaned up E2B sandbox');
        } catch (cleanupError) {
          console.error('[Create] ✗ Cleanup error:', cleanupError);
        }
      }

      throw error;
    }

  } catch (error) {
    console.error('[Create] ========================================');
    console.error('[Create] ✗✗✗ FATAL ERROR ✗✗✗');
    console.error('[Create] Error:', error);
    console.error('[Create] ========================================');
    
    return NextResponse.json(
      { 
        error: 'Failed to create sandbox',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
