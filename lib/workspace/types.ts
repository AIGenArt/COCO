// File system types with stable IDs

export type FileNodeType = "file" | "folder";

export interface FileNode {
  id: string;
  name: string;
  type: FileNodeType;
  path: string;
  parentId: string | null;
  content?: string; // Only for files
  children?: string[]; // Only for folders (array of child IDs)
  createdAt: number;
  updatedAt: number;
  modifiedByAI?: boolean; // Track AI modifications
  status?: 'new' | 'modified' | 'deleted' | 'unchanged'; // File status for visual indicators
}

export interface FileTree {
  nodes: Record<string, FileNode>;
  rootIds: string[];
}

export type WorkspaceMode = "plan" | "build";
export type BuildStatus = "idle" | "planning" | "building" | "stopping" | "stopped" | "done" | "failed";

export interface BuildSession {
  id: string;
  status: BuildStatus;
  startedAt: number;
  completedAt?: number;
  actions: string[]; // Action IDs
  filesAffected: string[]; // File IDs
  error?: string;
}

export interface WorkspaceState {
  // File system
  fileTree: FileTree;
  
  // Editor state
  activeFileId: string | null;
  openFileIds: string[];
  dirtyFileIds: Set<string>;
  
  // Explorer state
  selectedNodeId: string | null;
  expandedFolderIds: Set<string>;
  
  // Build session state
  currentMode: WorkspaceMode;
  buildStatus: BuildStatus;
  activeBuildSession: BuildSession | null;
  lockedByAI: boolean;
  pendingPreviewRefresh: boolean;
}

export interface WorkspaceActions {
  // File operations
  createFile: (parentId: string | null, name: string, content?: string) => string;
  createFolder: (parentId: string | null, name: string) => string;
  renameNode: (id: string, newName: string) => void;
  deleteNode: (id: string) => void;
  updateFileContent: (id: string, content: string, modifiedByAI?: boolean) => void;
  
  // Editor operations
  openFile: (id: string) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  markFileDirty: (id: string) => void;
  markFileClean: (id: string) => void;
  
  // Explorer operations
  setSelectedNode: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  expandFolder: (id: string) => void;
  collapseFolder: (id: string) => void;
  
  // Mode and build operations
  setMode: (mode: WorkspaceMode) => void;
  startBuild: (buildId: string) => void;
  stopBuild: () => void;
  completeBuild: (success: boolean, error?: string) => void;
  lockEditor: () => void;
  unlockEditor: () => void;
  markPreviewDirty: () => void;
  markPreviewClean: () => void;
  addBuildAction: (actionId: string) => void;
  addAffectedFile: (fileId: string) => void;
  
  // File status operations
  setFileStatus: (id: string, status: 'new' | 'modified' | 'deleted' | 'unchanged') => void;
  
  // Utility
  getNodeById: (id: string) => FileNode | undefined;
  getNodeByPath: (path: string) => FileNode | undefined;
  getNodeChildren: (id: string) => FileNode[];
  getFilePath: (id: string) => string;
  canEdit: () => boolean; // Check if editing is allowed
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;
