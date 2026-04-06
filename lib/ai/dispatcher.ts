import {
  AIActionRequest,
  AIActionResult,
  WorkspaceAccessContext
} from './types';

// AI Action Dispatcher for COCO
// Implements Sæt B, Regel B4: Runtime-eksekvering kun i isoleret sandbox

export async function dispatchAIAction(
  userId: string,
  workspace: WorkspaceAccessContext,
  action: AIActionRequest
): Promise<AIActionResult> {
  try {
    // Sæt B, Regel B4: Kun gennem runtime service
    // TODO: Integrate with runtime service when available
    
    switch (action.type) {
      case 'read_file':
        return await dispatchReadFile(action);
      
      case 'list_files':
        return await dispatchListFiles(action);
      
      case 'write_file':
        return await dispatchWriteFile(action);
      
      case 'run_command':
        return await dispatchRunCommand(action);
      
      case 'commit_changes':
        return await dispatchCommitChanges(action);
      
      case 'open_pr':
        return await dispatchOpenPR(action);
      
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function dispatchReadFile(
  action: Extract<AIActionRequest, { type: 'read_file' }>
): Promise<AIActionResult> {
  // TODO: Implement with runtime service
  console.log(`[DISPATCHER] Reading file: ${action.path}`);
  
  return {
    success: true,
    data: {
      path: action.path,
      content: '// File content would be here'
    }
  };
}

async function dispatchListFiles(
  action: Extract<AIActionRequest, { type: 'list_files' }>
): Promise<AIActionResult> {
  // TODO: Implement with runtime service
  console.log(`[DISPATCHER] Listing files in: ${action.path}`);
  
  return {
    success: true,
    data: {
      path: action.path,
      files: []
    }
  };
}

async function dispatchWriteFile(
  action: Extract<AIActionRequest, { type: 'write_file' }>
): Promise<AIActionResult> {
  // TODO: Implement with runtime service
  console.log(`[DISPATCHER] Writing file: ${action.path}`);
  
  // Validate path for security
  if (isPathTraversal(action.path)) {
    throw new Error('Path traversal attempt detected');
  }
  
  return {
    success: true,
    data: {
      path: action.path,
      written: true
    }
  };
}

async function dispatchRunCommand(
  action: Extract<AIActionRequest, { type: 'run_command' }>
): Promise<AIActionResult> {
  // TODO: Implement with runtime service
  const commandStr = action.command.join(' ');
  console.log(`[DISPATCHER] Running command: ${commandStr}`);
  
  // Validate command for security
  if (isDangerousCommand(commandStr)) {
    throw new Error('Dangerous command blocked');
  }
  
  return {
    success: true,
    data: {
      command: action.command,
      exitCode: 0,
      stdout: '',
      stderr: ''
    }
  };
}

async function dispatchCommitChanges(
  action: Extract<AIActionRequest, { type: 'commit_changes' }>
): Promise<AIActionResult> {
  // TODO: Implement Git integration
  console.log(`[DISPATCHER] Committing changes: ${action.message}`);
  
  throw new Error('Git operations not yet implemented');
}

async function dispatchOpenPR(
  action: Extract<AIActionRequest, { type: 'open_pr' }>
): Promise<AIActionResult> {
  // TODO: Implement GitHub PR integration
  console.log(`[DISPATCHER] Opening PR: ${action.title}`);
  
  throw new Error('GitHub PR operations not yet implemented');
}

// Security helpers
function isPathTraversal(path: string): boolean {
  return path.includes('../') || path.includes('..\\');
}

function isDangerousCommand(command: string): boolean {
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    /:\(\)\{\s*:\|\:&\s*\};:/,  // Fork bomb
    /nc\s+-l/,                   // Netcat listener
    /\/dev\/tcp/,                // Reverse shell
    /curl.*\|\s*bash/,           // Pipe to bash
    /wget.*\|\s*sh/,             // Pipe to sh
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(command));
}
