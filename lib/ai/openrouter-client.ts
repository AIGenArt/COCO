// OpenRouter Client for DeepSeek Integration

import { DebugLogger } from './debug-logger';

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
  tools?: OpenRouterTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenRouterToolCall[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenRouterClient {
  private apiKey: string;
  private baseURL: string = "https://openrouter.ai/api/v1";
  private rateLimitRetryDelay: number = 60000; // 60 seconds
  private maxRetries: number = 3;
  
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    
    if (!this.apiKey) {
      console.warn("OPENROUTER_API_KEY not set. AI features will not work.");
    }
  }
  
  /**
   * Call OpenRouter API with retry logic and rate limit handling
   */
  async chat(
    model: string,
    messages: OpenRouterMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
      tools?: OpenRouterTool[];
      toolChoice?: 'auto' | 'none';
      retryCount?: number;
    } = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key not configured");
    }
    
    const retryCount = options.retryCount ?? 0;
    
    const request: OpenRouterRequest = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4000,
    };
    
    if (options.jsonMode) {
      request.response_format = { type: "json_object" };
    }

    if (options.tools && options.tools.length > 0) {
      request.tools = options.tools;
      request.tool_choice = options.toolChoice ?? 'auto';
    }
    
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "COCO AI Workspace",
        },
        body: JSON.stringify(request),
      });
      
      // Handle rate limit (429)
      if (response.status === 429) {
        if (retryCount < this.maxRetries) {
          console.warn(`Rate limit hit (429). Retrying in ${this.rateLimitRetryDelay / 1000}s... (attempt ${retryCount + 1}/${this.maxRetries})`);
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.rateLimitRetryDelay));
          
          // Retry with same model
          return this.chat(model, messages, { ...options, retryCount: retryCount + 1 });
        } else {
          // Max retries reached, try fallback model
          const fallbackModel = process.env.AI_MODEL_FALLBACK || "openrouter/free";
          if (model !== fallbackModel) {
            console.warn(`Max retries reached. Falling back to ${fallbackModel}`);
            return this.chat(fallbackModel, messages, { ...options, retryCount: 0 });
          } else {
            throw new Error("Rate limit exceeded. Please try again later. (Max 200 requests/day on free tier)");
          }
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        const errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : JSON.stringify(errorData.error || errorData);
        console.error('[OpenRouter] API error response:', errorData);
        throw new Error(`OpenRouter API error: ${errorMessage}`);
      }
      
      const data: OpenRouterResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from OpenRouter");
      }

      const message = data.choices[0].message;
      
      // Return content or tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Return tool calls as JSON for processing
        return JSON.stringify({
          type: 'tool_calls',
          tool_calls: message.tool_calls,
        });
      }
      
      return message.content || '';
      
    } catch (error) {
      // If it's a rate limit error and we haven't exhausted retries, propagate it
      if (error instanceof Error && error.message.includes("Rate limit")) {
        throw error;
      }
      
      console.error("OpenRouter API error:", error);
      throw error;
    }
  }
  
  /**
   * Plan mode: Use deepseek-chat for analysis and planning
   */
  async plan(prompt: string, context?: any): Promise<string> {
    const model = process.env.AI_MODEL_PLAN || "deepseek/deepseek-chat";
    
    DebugLogger.log('PLAN', `Starting plan generation with model: ${model}`);
    DebugLogger.log('PLAN', `Prompt: ${prompt}`);
    
    const systemPrompt = `You are an expert coding assistant for COCO, an AI-powered development workspace.

Your task is to analyze the user's request and create a detailed plan.

Return your response as JSON with this structure:
{
  "summary": "Brief description of what you'll build",
  "actions": [
    {
      "type": "write_file",
      "path": "path/to/file.tsx",
      "description": "What this file does",
      "content": "// Full file content here"
    }
  ]
}

Guidelines:
- Be specific about file paths and names
- Use TypeScript and React best practices
- Include complete, working code
- Follow Next.js App Router conventions
- Use Tailwind CSS for styling
- Make components reusable and well-structured`;

    const userPrompt = context 
      ? `${prompt}\n\nCurrent workspace context:\n${JSON.stringify(context, null, 2)}`
      : prompt;
    
    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
    
    try {
      const result = await this.chat(model, messages, {
        temperature: 0.7,
        maxTokens: 4000,
        jsonMode: true,
      });
      
      DebugLogger.success('PLAN', 'Plan generated successfully');
      DebugLogger.log('PLAN', 'Response preview:', result.substring(0, 200) + '...');
      
      return result;
    } catch (error) {
      DebugLogger.error('PLAN', 'Failed to generate plan', error);
      throw error;
    }
  }
  
  /**
   * Build mode: Use deepseek-v3 for code generation
   */
  async build(prompt: string, plan: any, context?: any): Promise<string> {
    const model = process.env.AI_MODEL_BUILD || "deepseek/deepseek-v3";
    
    const systemPrompt = `You are an expert code generator for COCO workspace.

Given a plan and user request, generate the exact code needed.

Return your response as JSON with this structure:
{
  "files": [
    {
      "path": "path/to/file.tsx",
      "content": "// Complete file content"
    }
  ]
}

Guidelines:
- Generate complete, production-ready code
- Follow the plan exactly
- Use TypeScript and React best practices
- Include all imports and exports
- Make code clean and well-commented`;

    const userPrompt = `Request: ${prompt}\n\nPlan: ${JSON.stringify(plan, null, 2)}`;
    
    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
    
    return this.chat(model, messages, {
      temperature: 0.3, // Lower temperature for more consistent code
      maxTokens: 8000,
      jsonMode: true,
    });
  }
  
  /**
   * Get user-friendly rate limit message
   */
  getRateLimitMessage(retryCount: number): string {
    const waitTime = Math.ceil(this.rateLimitRetryDelay / 1000);
    
    if (retryCount === 0) {
      return `Rate limit reached. Retrying in ${waitTime} seconds...`;
    } else if (retryCount < this.maxRetries) {
      return `Still rate limited. Retry ${retryCount + 1}/${this.maxRetries} in ${waitTime} seconds...`;
    } else {
      return `Rate limit exceeded. Switching to fallback model...`;
    }
  }
  
  /**
   * Check if error is a rate limit error
   */
  isRateLimitError(error: any): boolean {
    if (error instanceof Error) {
      return error.message.includes("Rate limit") || error.message.includes("429");
    }
    return false;
  }
}

// Singleton instance
export const openRouterClient = new OpenRouterClient();
