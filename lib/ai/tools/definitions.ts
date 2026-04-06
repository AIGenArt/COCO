import { z } from 'zod';

/**
 * COCO AI Tool Definitions
 * Type-safe tool calling system inspired by Vibe SDK
 */

// Tool parameter schemas
export const toolSchemas = {
  createFile: z.object({
    path: z.string().describe('File path relative to workspace root'),
    content: z.string().describe('File content'),
  }),
  
  editFile: z.object({
    path: z.string().describe('File path to edit'),
    content: z.string().describe('New file content'),
  }),
  
  deleteFile: z.object({
    path: z.string().describe('File path to delete'),
  }),
  
  readFile: z.object({
    path: z.string().describe('File path to read'),
  }),
  
  listFiles: z.object({
    directory: z.string().optional().describe('Directory to list (default: root)'),
  }),
  
  executeCommand: z.object({
    command: z.string().describe('Shell command to execute'),
    workingDirectory: z.string().optional().describe('Working directory'),
  }),
  
  searchFiles: z.object({
    query: z.string().describe('Search query'),
    filePattern: z.string().optional().describe('File pattern to filter (e.g., *.ts)'),
  }),
} as const;

// Tool definitions with descriptions
export const tools = {
  createFile: {
    description: 'Create a new file in the workspace',
    parameters: toolSchemas.createFile,
  },
  
  editFile: {
    description: 'Edit an existing file in the workspace',
    parameters: toolSchemas.editFile,
  },
  
  deleteFile: {
    description: 'Delete a file from the workspace',
    parameters: toolSchemas.deleteFile,
  },
  
  readFile: {
    description: 'Read the contents of a file',
    parameters: toolSchemas.readFile,
  },
  
  listFiles: {
    description: 'List files in a directory',
    parameters: toolSchemas.listFiles,
  },
  
  executeCommand: {
    description: 'Execute a shell command in the workspace',
    parameters: toolSchemas.executeCommand,
  },
  
  searchFiles: {
    description: 'Search for files matching a query',
    parameters: toolSchemas.searchFiles,
  },
} as const;

// Type exports
export type ToolName = keyof typeof tools;
export type ToolParameters<T extends ToolName> = z.infer<typeof toolSchemas[T]>;

// Tool call result type
export interface ToolCallResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Tool execution context
export interface ToolContext {
  workspaceId: string;
  userId: string;
}
