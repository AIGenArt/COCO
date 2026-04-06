// Action Executor - Maps AI actions to workspace store operations

import { useWorkspaceStore } from "./workspace-store";
import { PlannedAction } from "@/lib/ai/action-store";

export interface ExecutionProgress {
  actionId: string;
  status: "pending" | "executing" | "completed" | "failed";
  message?: string;
  fileId?: string;
}

export interface ExecutionResult {
  success: boolean;
  completedActions: string[];
  failedActions: string[];
  filesAffected: string[];
  error?: string;
}

class ActionExecutor {
  /**
   * Execute a batch of approved actions
   */
  async executeBatch(
    actions: PlannedAction[],
    onProgress?: (progress: ExecutionProgress) => void
  ): Promise<ExecutionResult> {
    const store = useWorkspaceStore.getState();
    const completedActions: string[] = [];
    const failedActions: string[] = [];
    const filesAffected: string[] = [];
    
    // Note: We don't check canEdit() here because this is called BY the AI
    // during a build session. The editor is locked to prevent USER edits,
    // but AI actions should still be able to execute.
    
    for (const action of actions) {
      // Check if build was stopped
      if (store.buildStatus === "stopping" || store.buildStatus === "stopped") {
        failedActions.push(action.id);
        onProgress?.({
          actionId: action.id,
          status: "failed",
          message: "Build stopped by user",
        });
        continue;
      }
      
      onProgress?.({
        actionId: action.id,
        status: "executing",
        message: `Executing ${action.action.type}...`,
      });
      
      try {
        const result = await this.executeAction(action);
        
        completedActions.push(action.id);
        if (result.fileId) {
          filesAffected.push(result.fileId);
        }
        
        onProgress?.({
          actionId: action.id,
          status: "completed",
          message: result.message,
          fileId: result.fileId,
        });
        
        // Mark preview dirty if file was modified
        if (result.fileId) {
          store.markPreviewDirty();
        }
        
        // Small delay between actions for UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        failedActions.push(action.id);
        onProgress?.({
          actionId: action.id,
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    
    return {
      success: failedActions.length === 0,
      completedActions,
      failedActions,
      filesAffected,
      error: failedActions.length > 0 
        ? `${failedActions.length} action(s) failed`
        : undefined,
    };
  }
  
  /**
   * Execute a single action
   */
  private async executeAction(action: PlannedAction): Promise<{
    fileId?: string;
    message: string;
  }> {
    const store = useWorkspaceStore.getState();
    
    switch (action.action.type) {
      case "write_file":
        return this.executeWriteFile(action);
        
      case "read_file":
        return this.executeReadFile(action);
        
      case "list_files":
        return this.executeListFiles(action);
        
      case "run_command":
        return this.executeRunCommand(action);
        
      default:
        throw new Error(`Unknown action type: ${action.action.type}`);
    }
  }
  
  /**
   * Execute write_file action
   */
  private async executeWriteFile(action: PlannedAction): Promise<{
    fileId: string;
    message: string;
  }> {
    const store = useWorkspaceStore.getState();
    
    if (action.action.type !== 'write_file') {
      throw new Error('Invalid action type');
    }
    
    const { path, content } = action.action;
    
    // Check if file exists
    const existingFile = store.getNodeByPath(path);
    
    if (existingFile) {
      // Update existing file
      store.updateFileContent(existingFile.id, content, true);
      store.addAffectedFile(existingFile.id);
      
      return {
        fileId: existingFile.id,
        message: `Updated ${path}`,
      };
    } else {
      // Create new file
      const pathParts = path.split("/");
      const fileName = pathParts.pop()!;
      const parentPath = pathParts.join("/");
      
      // Find or create parent folder
      let parentId: string | null = null;
      if (parentPath) {
        const parentNode = store.getNodeByPath(parentPath);
        if (parentNode && parentNode.type === "folder") {
          parentId = parentNode.id;
        } else {
          // Create parent folders if needed
          parentId = this.createFolderPath(parentPath);
        }
      }
      
      const fileId = store.createFile(parentId, fileName, content);
      store.addAffectedFile(fileId);
      
      // Open the new file
      store.openFile(fileId);
      
      return {
        fileId,
        message: `Created ${path}`,
      };
    }
  }
  
  /**
   * Execute read_file action
   */
  private async executeReadFile(action: PlannedAction): Promise<{
    message: string;
  }> {
    const store = useWorkspaceStore.getState();
    
    if (action.action.type !== 'read_file') {
      throw new Error('Invalid action type');
    }
    
    const { path } = action.action;
    const file = store.getNodeByPath(path);
    
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    
    if (file.type !== "file") {
      throw new Error(`Not a file: ${path}`);
    }
    
    return {
      message: `Read ${path}`,
    };
  }
  
  /**
   * Execute list_files action
   */
  private async executeListFiles(action: PlannedAction): Promise<{
    message: string;
  }> {
    const store = useWorkspaceStore.getState();
    
    if (action.action.type !== 'list_files') {
      throw new Error('Invalid action type');
    }
    
    const { path } = action.action;
    
    if (path) {
      const folder = store.getNodeByPath(path);
      if (!folder) {
        throw new Error(`Folder not found: ${path}`);
      }
      if (folder.type !== "folder") {
        throw new Error(`Not a folder: ${path}`);
      }
    }
    
    return {
      message: path ? `Listed files in ${path}` : "Listed files",
    };
  }
  
  /**
   * Execute run_command action (simulated for now)
   */
  private async executeRunCommand(action: PlannedAction): Promise<{
    message: string;
  }> {
    if (action.action.type !== 'run_command') {
      throw new Error('Invalid action type');
    }
    
    const { command } = action.action;
    
    // For now, just log the command
    // In the future, this could execute in a sandboxed environment
    console.log(`[Simulated] Running command: ${command.join(' ')}`);
    
    return {
      message: `Executed: ${command.join(' ')}`,
    };
  }
  
  /**
   * Helper: Create folder path recursively
   */
  private createFolderPath(path: string): string {
    const store = useWorkspaceStore.getState();
    const parts = path.split("/");
    let currentPath = "";
    let parentId: string | null = null;
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      let folder = store.getNodeByPath(currentPath);
      
      if (!folder) {
        // Create folder
        const folderId = store.createFolder(parentId, part);
        folder = store.getNodeById(folderId);
      }
      
      if (folder && folder.type === "folder") {
        parentId = folder.id;
      }
    }
    
    return parentId!;
  }
  
  /**
   * Validate action before execution
   */
  validateAction(action: PlannedAction): { valid: boolean; error?: string } {
    // Validate based on action type
    switch (action.action.type) {
      case "write_file":
        if (!action.action.path || action.action.content === undefined) {
          return { valid: false, error: "write_file requires path and content" };
        }
        break;
        
      case "read_file":
        if (!action.action.path) {
          return { valid: false, error: "read_file requires path" };
        }
        break;
        
      case "list_files":
        if (!action.action.path) {
          return { valid: false, error: "list_files requires path" };
        }
        break;
        
      case "run_command":
        if (!action.action.command || action.action.command.length === 0) {
          return { valid: false, error: "run_command requires command" };
        }
        break;
        
      default:
        return { valid: false, error: `Unknown action type: ${action.action.type}` };
    }
    
    return { valid: true };
  }
}

// Singleton instance
export const actionExecutor = new ActionExecutor();
