import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reconcileSandboxes } from '@/lib/sandbox/sandbox-reconciliation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sandboxes/reconcile
 * Reconcile all sandboxes in database with E2B
 * Admin endpoint for manual reconciliation
 */
export async function POST(request: NextRequest) {
  console.log('[API] POST /api/sandboxes/reconcile called');
  
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[API] User authenticated:', user.id);
    console.log('[API] Starting reconciliation...');

    // Run reconciliation
    const result = await reconcileSandboxes();

    console.log('[API] Reconciliation complete:', result);

    return NextResponse.json({
      success: true,
      result,
    }, { status: 200 });

  } catch (error) {
    console.error('[API] Reconciliation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to reconcile sandboxes',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
