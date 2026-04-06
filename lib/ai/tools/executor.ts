import { 
  ToolName, 
  ToolParameters, 
  ToolCallResult, 
  ToolContext,
  toolSchemas 
} from './definitions';

/**
 * COCO AI Tool Executor
 * Executes AI tool calls with validation and error handling
 */

export class ToolExecutor {
  private context: ToolContext;

  constructor(context: ToolContext) {
    this.context = context;
  }

  /**
   * Execute a tool call with validation
   */
  async execute<T extends ToolName>(
    toolName: T,
    parameters: unknown
  ): Promise<ToolCallResult> {
    try {
      // Validate parameters
      const schema = toolSchemas[toolName];
      const validatedParams = schema.parse(parameters) as ToolParameters<T>;

      // Execute the tool
      switch (toolName) {
        case 'createFile':
          return await this.createFile(validatedParams as ToolParameters<'createFile'>);
        
        case 'editFile':
          return await this.editFile(validatedParams as ToolParameters<'editFile'>);
        
        case 'deleteFile':
          return await this.deleteFile(validatedParams as ToolParameters<'deleteFile'>);
        
        case 'readFile':
          return await this.readFile(validatedParams as ToolParameters<'readFile'>);
        
        case 'listFiles':
          return await this.listFiles(validatedParams as ToolParameters<'listFiles'>);
        
        case 'executeCommand':
          return await this.executeCommand(validatedParams as ToolParameters<'executeCommand'>);
        
        case 'searchFiles':
          return await this.searchFiles(validatedParams as ToolParameters<'searchFiles'>);
        
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Tool implementations
   */

  private async createFile(params: ToolParameters<'createFile'>): Promise<ToolCallResult> {
    try {
      const response = await fetch(`/api/workspace/${this.context.workspaceId}/fs/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: params.path,
          content: params.content,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create file');
      }

      return {
        success: true,
        data: { path: params.path },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create file',
      };
    }
  }

  private async editFile(params: ToolParameters<'editFile'>): Promise<ToolCallResult> {
    try {
      const response = await fetch(`/api/workspace/${this.context.workspaceId}/fs/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: params.path,
          content: params.content,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to edit file');
      }

      return {
        success: true,
        data: { path: params.path },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit file',
      };
    }
  }

  private async deleteFile(params: ToolParameters<'deleteFile'>): Promise<ToolCallResult> {
    try {
      const response = await fetch(`/api/workspace/${this.context.workspaceId}/fs/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: params.path,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete file');
      }

      return {
        success: true,
        data: { path: params.path },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file',
      };
    }
  }

  private async readFile(params: ToolParameters<'readFile'>): Promise<ToolCallResult> {
    try {
      const response = await fetch(
        `/api/workspace/${this.context.workspaceId}/fs/read?path=${encodeURIComponent(params.path)}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to read file');
      }

      const data = await response.json();
      return {
        success: true,
        data: { content: data.content },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
      };
    }
  }

  private async listFiles(params: ToolParameters<'listFiles'>): Promise<ToolCallResult> {
    try {
      const directory = params.directory || '';
      const response = await fetch(
        `/api/workspace/${this.context.workspaceId}/fs/list?directory=${encodeURIComponent(directory)}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to list files');
      }

      const data = await response.json();
      return {
        success: true,
        data: { files: data.files },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list files',
      };
    }
  }

  private async executeCommand(params: ToolParameters<'executeCommand'>): Promise<ToolCallResult> {
    try {
      const response = await fetch(`/api/workspace/${this.context.workspaceId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: params.command,
          workingDirectory: params.workingDirectory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to execute command');
      }

      const data = await response.json();
      return {
        success: true,
        data: { output: data.output, exitCode: data.exitCode },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute command',
      };
    }
  }

  private async searchFiles(params: ToolParameters<'searchFiles'>): Promise<ToolCallResult> {
    try {
      const response = await fetch(
        `/api/workspace/${this.context.workspaceId}/fs/search?` +
        `query=${encodeURIComponent(params.query)}` +
        (params.filePattern ? `&pattern=${encodeURIComponent(params.filePattern)}` : '')
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to search files');
      }

      const data = await response.json();
      return {
        success: true,
        data: { results: data.results },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search files',
      };
    }
  }
}
