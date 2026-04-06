import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * COCO Preview Asset Proxy
 * 
 * Proxies all assets (JS, CSS, images, etc.) from localhost:3000
 * This ensures the preview works completely embedded.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Construct the target URL
    const path = params.path.join('/');
    const targetUrl = `http://localhost:3000/${path}`;
    
    // Add query params if any
    const searchParams = request.nextUrl.searchParams.toString();
    const fullUrl = searchParams ? `${targetUrl}?${searchParams}` : targetUrl;
    
    // Fetch the asset
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': request.headers.get('user-agent') || '',
      },
    });

    // Get content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Get the content
    const content = await response.arrayBuffer();
    
    // Return with proper headers
    return new NextResponse(content, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Preview asset proxy error:', error);
    
    return new NextResponse('Asset not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}
