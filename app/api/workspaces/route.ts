import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/workspaces - Get all workspaces for the authenticated user
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      );
    }
    
    if (!user) {
      console.error('No user found in session');
      return NextResponse.json(
        { error: 'Not authenticated', details: 'Please log in to create a workspace' },
        { status: 401 }
      );
    }

    console.log('User authenticated:', user.id);

    // Fetch user's workspaces
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching workspaces:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: 500 }
      );
    }

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Unexpected error in GET /api/workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/workspaces - Create a new workspace
export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          details: 'Supabase environment variables are not configured. Please check .env.local file.'
        },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('POST - Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      );
    }
    
    if (!user) {
      console.error('POST - No user found in session');
      return NextResponse.json(
        { error: 'Not authenticated', details: 'Please log in to create a workspace' },
        { status: 401 }
      );
    }

    console.log('POST - User authenticated:', user.id, user.email);

    // Check workspace limit (max 2 workspaces per user)
    const { count, error: countError } = await supabase
      .from('workspaces')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Error counting workspaces:', countError);
      return NextResponse.json(
        { error: 'Failed to check workspace limit' },
        { status: 500 }
      );
    }

    if (count !== null && count >= 2) {
      return NextResponse.json(
        { error: 'Workspace limit reached. Maximum 2 workspaces allowed.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, description, template } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    // Create workspace
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        template: template || 'nextjs',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workspace:', error);
      return NextResponse.json(
        { error: 'Failed to create workspace' },
        { status: 500 }
      );
    }

    // Log workspace creation event (non-blocking, fire-and-forget)
    void supabase
      .from('sandbox_events')
      .insert({
        workspace_id: workspace.id,
        event_type: 'workspace_created',
        severity: 'info',
        message: `Workspace "${workspace.name}" created`,
        metadata: {
          template: workspace.template,
        },
      });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
