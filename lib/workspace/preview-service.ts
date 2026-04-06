// Preview Service - Manages live preview with Sandpack

import { useWorkspaceStore } from "./workspace-store";
import { SandpackFiles } from "@codesandbox/sandpack-react";

export class PreviewService {
  private static instance: PreviewService;
  private updateCallbacks: Set<(files: SandpackFiles) => void> = new Set();
  
  private constructor() {
    // Subscribe to workspace changes
    this.setupFileWatcher();
  }
  
  static getInstance(): PreviewService {
    if (!PreviewService.instance) {
      PreviewService.instance = new PreviewService();
    }
    return PreviewService.instance;
  }
  
  /**
   * Setup file watcher to detect changes
   */
  private setupFileWatcher() {
    // Subscribe to workspace store changes
    useWorkspaceStore.subscribe((state, prevState) => {
      // Check if fileTree changed
      if (state.fileTree !== prevState.fileTree) {
        this.notifyUpdate();
      }
    });
  }
  
  /**
   * Convert workspace files to Sandpack format
   */
  getFiles(): SandpackFiles {
    const store = useWorkspaceStore.getState();
    const files: SandpackFiles = {};
    
    // Convert workspace files to Sandpack format
    const convertNode = (nodeId: string) => {
      const node = store.fileTree.nodes[nodeId];
      if (!node) return;
      
      const fullPath = store.getFilePath(nodeId);
      
      if (node.type === "file") {
        files[`/${fullPath}`] = {
          code: node.content || "",
        };
      } else if (node.type === "folder" && node.children) {
        node.children.forEach(childId => convertNode(childId));
      }
    };
    
    // Start from root nodes
    store.fileTree.rootIds.forEach(nodeId => convertNode(nodeId));
    
    // Add package.json if not exists
    if (!files["/package.json"]) {
      files["/package.json"] = {
        code: JSON.stringify({
          name: "coco-preview",
          version: "1.0.0",
          dependencies: {
            "react": "^18.2.0",
            "react-dom": "^18.2.0"
          }
        }, null, 2)
      };
    }
    
    return files;
  }
  
  /**
   * Get entry file (main file to run)
   */
  getEntryFile(): string {
    const files = this.getFiles();
    
    // Priority order for entry file
    const entryPriority = [
      "/app/page.tsx",
      "/app/page.jsx",
      "/pages/index.tsx",
      "/pages/index.jsx",
      "/src/App.tsx",
      "/src/App.jsx",
      "/App.tsx",
      "/App.jsx",
      "/index.tsx",
      "/index.jsx",
    ];
    
    for (const entry of entryPriority) {
      if (files[entry]) {
        return entry;
      }
    }
    
    // Default to first file
    const firstFile = Object.keys(files)[0];
    return firstFile || "/App.tsx";
  }
  
  /**
   * Subscribe to file updates
   */
  onUpdate(callback: (files: SandpackFiles) => void) {
    this.updateCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }
  
  /**
   * Notify all subscribers of update
   */
  private notifyUpdate() {
    const files = this.getFiles();
    this.updateCallbacks.forEach(callback => callback(files));
  }
  
  /**
   * Manually trigger update
   */
  refresh() {
    this.notifyUpdate();
  }
}

// Singleton instance
export const previewService = PreviewService.getInstance();
