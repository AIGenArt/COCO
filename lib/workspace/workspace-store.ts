import { create } from "zustand";
import { WorkspaceStore, FileNode } from "./types";
import { createInitialFileTree } from "./initial-state";
import { createFileOperationsSlice } from "./file-operations";
import { createEditorOperationsSlice } from "./editor-operations";
import { createBuildSessionSlice } from "./build-session";

export const useWorkspaceStore = create<WorkspaceStore>((set, get, api) => ({
  // Initial state
  fileTree: createInitialFileTree(),
  activeFileId: null,
  openFileIds: [],
  dirtyFileIds: new Set(),
  selectedNodeId: null,
  expandedFolderIds: new Set(),
  
  // Build session state
  currentMode: "plan",
  buildStatus: "idle",
  activeBuildSession: null,
  lockedByAI: false,
  pendingPreviewRefresh: false,
  
  // File operations slice
  ...createFileOperationsSlice(set, get, api),
  
  // Editor operations slice
  ...createEditorOperationsSlice(set, get, api),
  
  // Build session slice
  ...createBuildSessionSlice(set, get, api),
  
  // Utility functions
  getNodeById: (id) => {
    return get().fileTree.nodes[id];
  },
  
  getNodeByPath: (path) => {
    const nodes = get().fileTree.nodes;
    return Object.values(nodes).find((node) => node.path === path);
  },
  
  getNodeChildren: (id) => {
    const node = get().fileTree.nodes[id];
    if (!node || node.type !== "folder" || !node.children) {
      return [];
    }
    
    return node.children
      .map((childId) => get().fileTree.nodes[childId])
      .filter(Boolean);
  },
  
  getFilePath: (id) => {
    const node = get().fileTree.nodes[id];
    return node?.path || "";
  },
}));
