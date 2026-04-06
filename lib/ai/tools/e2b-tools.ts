/**
 * E2B Tools for AI
 * 
 * Provides tool definitions and handlers for AI to directly control E2B sandboxes
 */

import { Sandbox } from 'e2b';

/**
 * Tool definitions for OpenRouter/Qwen
 */
export const e2bTools = [
  {
    type: 'function' as const,
    function: {
      name: 'execute_bash',
      description: 'Execute a bash command in the sandbox. Use this to run npm commands, start servers, check files, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The bash command to execute (e.g., "npm install", "ls -la", "cat package.json")',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Write content to a file in the sandbox. Creates directories if needed.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to sandbox root (e.g., "app/page.tsx")',
          },
          content: {
            type: 'string',
            description: 'Complete file content to write',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the contents of a file from the sandbox.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to sandbox root',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: 'List files in a directory in the sandbox.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path relative to sandbox root (default: ".")',
          },
        },
        required: [],
      },
    },
  },
];

/**
 * Tool handlers - execute the actual operations
 */
export class E2BToolHandler {
  constructor(private sandbox: Sandbox) {}

  async executeBash(command: string): Promise<string> {
    console.log('[E2B Tool] Executing bash:', command);
    
    try {
      const result = await this.sandbox.commands.run(command, {
        timeoutMs: 60000, // 60 second timeout
      });

      const output = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };

      console.log('[E2B Tool] Bash result:', output);
      
      return JSON.stringify(output, null, 2);
    } catch (error) {
      console.error('[E2B Tool] Bash error:', error);
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
      });
    }
  }

  async writeFile(path: string, content: string): Promise<string> {
    console.log('[E2B Tool] Writing file:', path);
    
    try {
      // Create directory if needed
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir) {
        await this.sandbox.files.makeDir(dir);
      }

      // Write file
      await this.sandbox.files.write(path, content);
      
      console.log('[E2B Tool] File written successfully');
      return JSON.stringify({ success: true, path });
    } catch (error) {
      console.error('[E2B Tool] Write error:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async readFile(path: string): Promise<string> {
    console.log('[E2B Tool] Reading file:', path);
    
    try {
      const content = await this.sandbox.files.read(path);
      console.log('[E2B Tool] File read successfully');
      
      return JSON.stringify({
        success: true,
        path,
        content,
      });
    } catch (error) {
      console.error('[E2B Tool] Read error:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'File not found',
      });
    }
  }

  async listFiles(path: string = '.'): Promise<string> {
    console.log('[E2B Tool] Listing files in:', path);
    
    try {
      const result = await this.sandbox.commands.run(`ls -la ${path}`);
      
      return JSON.stringify({
        success: true,
        path,
        output: result.stdout,
      });
    } catch (error) {
      console.error('[E2B Tool] List error:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle tool call from AI
   */
  async handleToolCall(toolName: string, args: any): Promise<string> {
    console.log('[E2B Tool] Handling tool call:', toolName, args);

    switch (toolName) {
      case 'execute_bash':
        return this.executeBash(args.command);
      
      case 'write_file':
        return this.writeFile(args.path, args.content);
      
      case 'read_file':
        return this.readFile(args.path);
      
      case 'list_files':
        return this.listFiles(args.path);
      
      default:
        return JSON.stringify({
          error: `Unknown tool: ${toolName}`,
        });
    }
  }
}

/**
 * System prompt for AI with E2B tools
 */
export const e2bSystemPrompt = `You are an expert coding assistant with direct access to an E2B sandbox environment.

You can execute code, write files, and test your work in real-time using these tools:
- execute_bash: Run bash commands (npm install, ls, cat, etc.)
- write_file: Create or update files
- read_file: Read file contents
- list_files: List directory contents

IMPORTANT WORKFLOW:
1. Write files using write_file
2. Test your code using execute_bash
3. Check for errors in the output
4. Fix any issues by updating files
5. Verify everything works before responding to user

BEST PRACTICES:
- Always test code after writing it
- Check npm install completes successfully
- Verify dev server starts without errors
- Read error messages and fix issues
- Iterate until code works perfectly

You MUST validate your code works before telling the user it's done.
Never return untested code.`;
