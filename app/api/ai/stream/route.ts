import { NextRequest } from 'next/server';
import { createStreamingAI } from '@/lib/ai/streaming-client';
import { ToolExecutor } from '@/lib/ai/tools/executor';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/stream
 * Stream AI responses with tool calling support
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { workspaceId, messages, model, temperature } = body;

    if (!workspaceId || !messages || !model) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify workspace access
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (workspaceError || !workspace) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found or access denied' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create streaming AI client
    const ai = createStreamingAI(apiKey);

    // Create tool executor
    const toolExecutor = new ToolExecutor({
      workspaceId,
      userId: user.id,
    });

    // Stream AI response with tool calling
    const result = await ai.stream({
      model,
      messages,
      temperature,
      onToolCall: async (toolName, args) => {
        console.log(`Tool call: ${toolName}`, args);
        return await toolExecutor.execute(toolName as any, args);
      },
    });

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Error in AI stream:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
