import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * COCO Preview Proxy
 * 
 * Proxies localhost:3000 to avoid cross-origin iframe restrictions.
 * This allows embedded preview to work within COCO.
 * 
 * Phase 2: Will proxy sandbox URLs (ws-{id}.coco.dev)
 */

export async function GET(request: NextRequest) {
  try {
    // Get the target URL (default: localhost:3000)
    const targetUrl = 'http://localhost:3000';
    
    // Fetch from localhost
    const response = await fetch(targetUrl, {
      headers: {
        // Forward relevant headers
        'User-Agent': request.headers.get('user-agent') || '',
      },
    });

    // Get the HTML content
    const html = await response.text();
    
    // Return with proper headers
    return new NextResponse(html, {
      status: response.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Preview proxy error:', error);
    
    // Return error page
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Preview Error</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: system-ui, -apple-system, sans-serif;
              background: #0b0d10;
              color: #e5e7eb;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
            }
            .error {
              text-align: center;
              padding: 2rem;
            }
            h1 {
              font-size: 1.5rem;
              margin-bottom: 1rem;
              color: #ef4444;
            }
            p {
              color: #9ca3af;
              margin-bottom: 1.5rem;
            }
            code {
              background: #1f2937;
              padding: 0.25rem 0.5rem;
              border-radius: 0.25rem;
              font-size: 0.875rem;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>⚠️ Preview Server Not Running</h1>
            <p>Could not connect to <code>localhost:3000</code></p>
            <p>Make sure your dev server is running with <code>npm run dev</code></p>
          </div>
        </body>
      </html>
      `,
      {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );
  }
}
