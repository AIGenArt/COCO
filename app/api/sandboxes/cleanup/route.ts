/**
 * POST /api/sandboxes/cleanup
 * 
 * Cleanup stale sandboxes (internal/cron only).
 * Protected by CRON_SECRET header.
 * Marks stale sandboxes as failed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SandboxManager } from '@/lib/sandbox/sandbox-manager';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify CRON_SECRET header
    const secret = request.headers.get('x-cron-secret');
    
    if (!secret || secret !== process.env.CRON_SECRET) {
      console.warn('Unauthorized cleanup attempt - invalid or missing CRON_SECRET');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting sandbox cleanup...');

    // Run cleanup
    const cleanedCount = await SandboxManager.cleanupStaleSandboxes();

    console.log(`Sandbox cleanup complete: ${cleanedCount} sandbox(es) cleaned`);

    return NextResponse.json({
      message: 'Cleanup completed',
      cleanedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error during sandbox cleanup:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Cleanup failed' 
      },
      { status: 500 }
    );
  }
}
