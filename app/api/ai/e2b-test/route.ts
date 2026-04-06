/**
 * POST /api/ai/e2b-test
 * 
 * Test endpoint for E2B AI integration
 * Creates a sandbox, gives AI access, and lets AI build something
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { E2BManager } from '@/lib/sandbox/e2b-manager';
import { createE2BAIService } from '@/lib/ai/e2b-ai-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for AI to work

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

    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('[E2B AI Test] Starting test with prompt:', prompt);

    // Step 1: Create E2B sandbox
    console.log('[E2B AI Test] Step 1: Creating sandbox...');
    const sandbox = await E2BManager.createSandbox('test-workspace');
    console.log('[E2B AI Test] Sandbox created:', sandbox.id);

    try {
      // Step 2: Create AI service with sandbox access
      console.log('[E2B AI Test] Step 2: Creating AI service...');
      const aiService = await createE2BAIService(sandbox.id);
      console.log('[E2B AI Test] AI service created');

      // Step 3: Let AI build the feature
      console.log('[E2B AI Test] Step 3: AI building feature...');
      const result = await aiService.buildFeature(prompt);
      console.log('[E2B AI Test] AI result:', result);

      // Step 4: Return result
      return NextResponse.json({
        success: true,
        sandboxId: sandbox.id,
        sandboxUrl: sandbox.url,
        result,
        messages: aiService.getMessages(),
      });

    } catch (error) {
      console.error('[E2B AI Test] Error:', error);
      
      // Clean up sandbox on error
      try {
        await E2BManager.destroySandbox('test-workspace');
      } catch (cleanupError) {
        console.error('[E2B AI Test] Failed to cleanup sandbox:', cleanupError);
      }

      throw error;
    }

  } catch (error) {
    console.error('[E2B AI Test] Failed:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to test E2B AI integration' 
      },
      { status: 500 }
    );
  }
}
