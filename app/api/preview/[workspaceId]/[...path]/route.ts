import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processManager } from '@/lib/sandbox/process-manager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/preview/[workspaceId]/[...path]
 * Proxy requests to workspace dev server
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string; path: string[] } }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const workspaceId = params.workspaceId;

    // Verify workspace ownership
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (workspaceError || !workspace) {
      return new NextResponse('Workspace not found', { status: 404 });
    }

    // Get process info
    const processInfo = processManager.getProcessInfo(workspaceId);

    if (!processInfo || processInfo.status !== 'running') {
      return new NextResponse('Workspace dev server not running', { status: 503 });
    }

    // Build target URL
    const targetPath = params.path ? params.path.join('/') : '';
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `http://localhost:${processInfo.port}/${targetPath}${searchParams ? `?${searchParams}` : ''}`;

    console.log(`Proxying request to: ${targetUrl}`);

    // Proxy the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        host: `localhost:${processInfo.port}`,
      },
    });

    // Create response with proxied content
    const body = await response.arrayBuffer();
    
    return new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

  } catch (error) {
    console.error('Error proxying preview request:', error);
    return new NextResponse('Preview proxy error', { status: 500 });
  }
}

// Support other HTTP methods
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string; path: string[] } }
) {
  return handleProxyRequest(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { workspaceId: string; path: string[] } }
) {
  return handleProxyRequest(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceId: string; path: string[] } }
) {
  return handleProxyRequest(request, params, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceId: string; path: string[] } }
) {
  return handleProxyRequest(request, params, 'PATCH');
}

async function handleProxyRequest(
  request: NextRequest,
  params: { workspaceId: string; path: string[] },
  method: string
) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const workspaceId = params.workspaceId;

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (workspaceError || !workspace) {
      return new NextResponse('Workspace not found', { status: 404 });
    }

    const processInfo = processManager.getProcessInfo(workspaceId);

    if (!processInfo || processInfo.status !== 'running') {
      return new NextResponse('Workspace dev server not running', { status: 503 });
    }

    const targetPath = params.path ? params.path.join('/') : '';
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `http://localhost:${processInfo.port}/${targetPath}${searchParams ? `?${searchParams}` : ''}`;

    const body = await request.arrayBuffer();

    const response = await fetch(targetUrl, {
      method,
      headers: {
        ...Object.fromEntries(request.headers),
        host: `localhost:${processInfo.port}`,
      },
      body: body.byteLength > 0 ? body : undefined,
    });

    const responseBody = await response.arrayBuffer();
    
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

  } catch (error) {
    console.error('Error proxying preview request:', error);
    return new NextResponse('Preview proxy error', { status: 500 });
  }
}
