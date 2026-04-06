import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { tools } from './tools/definitions';

/**
 * COCO Streaming AI Client
 * Integrates OpenRouter with Vercel AI SDK for streaming responses
 */

export interface StreamingAIOptions {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxSteps?: number;
  onToolCall?: (toolName: string, args: any) => Promise<any>;
}

export class StreamingAIClient {
  private openai: ReturnType<typeof createOpenAI>;

  constructor(apiKey: string) {
    // Configure OpenRouter as OpenAI-compatible endpoint
    this.openai = createOpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  /**
   * Stream AI response with tool calling support
   */
  async stream(options: StreamingAIOptions) {
    const {
      model,
      messages,
      temperature = 0.7,
      onToolCall,
    } = options;

    // Convert our tool definitions to AI SDK format
    const aiTools: Record<string, any> = {};
    
    for (const [name, tool] of Object.entries(tools)) {
      aiTools[name] = {
        description: tool.description,
        parameters: tool.parameters,
        execute: async (args: any) => {
          if (onToolCall) {
            return await onToolCall(name, args);
          }
          return { success: false, error: 'No tool handler provided' };
        },
      };
    }

    // Stream with tool calling
    const result = await streamText({
      model: this.openai(model),
      messages,
      tools: aiTools,
      temperature,
    });

    return result;
  }

  /**
   * Stream text-only response (no tools)
   */
  async streamText(options: Omit<StreamingAIOptions, 'onToolCall'>) {
    const {
      model,
      messages,
      temperature = 0.7,
    } = options;

    const result = await streamText({
      model: this.openai(model),
      messages,
      temperature,
    });

    return result;
  }
}

/**
 * Create a streaming AI client instance
 */
export function createStreamingAI(apiKey: string) {
  return new StreamingAIClient(apiKey);
}
