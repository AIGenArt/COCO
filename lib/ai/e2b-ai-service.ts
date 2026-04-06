/**
 * E2B AI Service
 * 
 * Integrates OpenRouter AI with E2B sandbox for direct code execution
 */

import { Sandbox } from 'e2b';
import { openRouterClient } from './openrouter-client';
import { e2bTools, E2BToolHandler, e2bSystemPrompt } from './tools/e2b-tools';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

interface E2BAIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
}

/**
 * E2B AI Service - AI with direct sandbox access
 */
export class E2BAIService {
  private toolHandler: E2BToolHandler;
  private messages: Message[] = [];

  constructor(private sandbox: Sandbox) {
    this.toolHandler = new E2BToolHandler(sandbox);
  }

  /**
   * Chat with AI that has direct sandbox access
   * AI can execute code, write files, and iterate until working
   */
  async chat(
    userPrompt: string,
    options: E2BAIOptions = {}
  ): Promise<string> {
    const {
      model = process.env.AI_MODEL_BUILD || 'qwen/qwen3.6-plus:free',
      temperature = 0.7,
      maxTokens = 8000,
      maxIterations = 10,
    } = options;

    console.log('[E2B AI] Starting chat with sandbox access');
    console.log('[E2B AI] Model:', model);
    console.log('[E2B AI] User prompt:', userPrompt);

    // Initialize conversation with system prompt
    this.messages = [
      { role: 'system', content: e2bSystemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let iteration = 0;
    let finalResponse = '';

    while (iteration < maxIterations) {
      iteration++;
      console.log(`[E2B AI] Iteration ${iteration}/${maxIterations}`);

      try {
        // Call AI with tools
        const response = await openRouterClient.chat(
          model,
          this.messages as any,
          {
            temperature,
            maxTokens,
            tools: e2bTools as any,
            toolChoice: 'auto',
          }
        );

        // Check if AI wants to use tools
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(response);
        } catch {
          // Not JSON, it's a regular text response
          finalResponse = response;
          console.log('[E2B AI] AI returned final response');
          break;
        }

        // Handle tool calls
        if (parsedResponse.type === 'tool_calls') {
          console.log('[E2B AI] AI requested tool calls:', parsedResponse.tool_calls.length);

          // Add assistant message with tool calls
          this.messages.push({
            role: 'assistant',
            content: '', // Empty content when using tools
          });

          // Execute each tool call
          for (const toolCall of parsedResponse.tool_calls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            console.log(`[E2B AI] Executing tool: ${toolName}`, toolArgs);

            // Execute tool
            const toolResult = await this.toolHandler.handleToolCall(toolName, toolArgs);

            console.log(`[E2B AI] Tool result:`, toolResult.substring(0, 200));

            // Add tool result to conversation
            this.messages.push({
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCall.id,
              name: toolName,
            });
          }

          // Continue conversation - AI will see tool results and decide next step
          continue;
        }

        // Unknown response format
        console.warn('[E2B AI] Unknown response format:', parsedResponse);
        finalResponse = JSON.stringify(parsedResponse);
        break;

      } catch (error) {
        console.error('[E2B AI] Error in iteration:', error);
        throw error;
      }
    }

    if (iteration >= maxIterations) {
      console.warn('[E2B AI] Max iterations reached');
      finalResponse = 'Max iterations reached. The AI may not have completed the task.';
    }

    console.log('[E2B AI] Chat complete');
    return finalResponse;
  }

  /**
   * Build a feature with AI that tests and validates code
   */
  async buildFeature(
    featureDescription: string,
    options: E2BAIOptions = {}
  ): Promise<{ success: boolean; message: string; files?: string[] }> {
    console.log('[E2B AI] Building feature:', featureDescription);

    const prompt = `Build this feature: ${featureDescription}

IMPORTANT:
1. Write all necessary files using write_file
2. Run npm install if you add dependencies
3. Test your code using execute_bash
4. Fix any errors you encounter
5. Verify the dev server starts successfully
6. Only respond when everything is working

Return a JSON response when done:
{
  "success": true,
  "message": "Feature built successfully",
  "files": ["list", "of", "files", "created"]
}`;

    try {
      const response = await this.chat(prompt, {
        ...options,
        maxIterations: 15, // More iterations for building features
      });

      // Parse response
      try {
        const result = JSON.parse(response);
        return result;
      } catch {
        // If not JSON, treat as success message
        return {
          success: true,
          message: response,
        };
      }
    } catch (error) {
      console.error('[E2B AI] Failed to build feature:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fix an error in the sandbox
   */
  async fixError(
    errorMessage: string,
    context?: string
  ): Promise<{ success: boolean; message: string }> {
    console.log('[E2B AI] Fixing error:', errorMessage);

    const prompt = `There's an error in the sandbox:

Error: ${errorMessage}

${context ? `Context: ${context}` : ''}

Please:
1. Read relevant files to understand the issue
2. Fix the error
3. Test that it's resolved
4. Confirm everything works

Return JSON when done:
{
  "success": true,
  "message": "Error fixed successfully"
}`;

    try {
      const response = await this.chat(prompt, {
        maxIterations: 10,
      });

      try {
        return JSON.parse(response);
      } catch {
        return {
          success: true,
          message: response,
        };
      }
    } catch (error) {
      console.error('[E2B AI] Failed to fix error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get conversation history
   */
  getMessages(): Message[] {
    return this.messages;
  }
}

/**
 * Create E2B AI service for a sandbox
 */
export async function createE2BAIService(sandboxId: string): Promise<E2BAIService> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error('E2B_API_KEY not configured');
  }

  console.log('[E2B AI] Connecting to sandbox:', sandboxId);
  
  // Connect to existing sandbox with extended timeout for AI operations
  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey,
    timeoutMs: 300000, // 5 minutes - AI needs time to work
  });

  console.log('[E2B AI] Connected successfully');

  return new E2BAIService(sandbox);
}
