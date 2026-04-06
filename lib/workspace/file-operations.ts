import { StateCreator } from "zustand";
import { WorkspaceStore, FileNode } from "./types";
import { generateId } from "./initial-state";

export interface FileOperationsSlice {
  createFile: (parentId: string | null, name: string, content?: string) => string;
  createFolder: (parentId: string | null, name: string) => string;
  renameNode: (id: string, newName: string) => void;
  deleteNode: (id: string) => void;
  updateFileContent: (id: string, content: string, modifiedByAI?: boolean) => void;
  setFileStatus: (id: string, status: 'new' | 'modified' | 'deleted' | 'unchanged') => void;
}

export const createFileOperationsSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  FileOperationsSlice
> = (set, get) => ({
  createFile: (parentId, name, content = "") => {
    const id = generateId();
    const now = Date.now();
    const state = get();
    
    const parent = parentId ? state.fileTree.nodes[parentId] : null;
    const path = parent ? `${parent.path}/${name}` : name;
    
    const newNode: FileNode = {
      id,
      name,
      type: "file",
      path,
      parentId,
      content,
      createdAt: now,
      updatedAt: now,
      status: 'new', // Mark as new
    };
    
    set((state) => {
      const newNodes = { ...state.fileTree.nodes, [id]: newNode };
      
      // Update parent's children
      if (parentId && newNodes[parentId]) {
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...(newNodes[parentId].children || []), id],
          updatedAt: now,
        };
      }
      
      return {
        fileTree: {
          nodes: newNodes,
          rootIds: parentId ? state.fileTree.rootIds : [...state.fileTree.rootIds, id],
        },
      };
    });
    
    return id;
  },
  
  createFolder: (parentId, name) => {
    const id = generateId();
    const now = Date.now();
    const state = get();
    
    const parent = parentId ? state.fileTree.nodes[parentId] : null;
    const path = parent ? `${parent.path}/${name}` : name;
    
    const newNode: FileNode = {
      id,
      name,
      type: "folder",
      path,
      parentId,
      children: [],
      createdAt: now,
      updatedAt: now,
      status: 'new', // Mark as new
    };
    
    set((state) => {
      const newNodes = { ...state.fileTree.nodes, [id]: newNode };
      
      // Update parent's children
      if (parentId && newNodes[parentId]) {
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...(newNodes[parentId].children || []), id],
          updatedAt: now,
        };
      }
      
      return {
        fileTree: {
          nodes: newNodes,
          rootIds: parentId ? state.fileTree.rootIds : [...state.fileTree.rootIds, id],
        },
      };
    });
    
    return id;
  },
  
  renameNode: (id, newName) => {
    set((state) => {
      const node = state.fileTree.nodes[id];
      if (!node) return state;
      
      const newNodes = { ...state.fileTree.nodes };
      const newPath = node.parentId
        ? `${newNodes[node.parentId].path}/${newName}`
        : newName;
      
      // Update node
      newNodes[id] = {
        ...node,
        name: newName,
        path: newPath,
        updatedAt: Date.now(),
        status: 'modified', // Mark as modified
      };
      
      // Recursively update children paths
      const updateChildrenPaths = (nodeId: string) => {
        const node = newNodes[nodeId];
        if (node.type === "folder" && node.children) {
          node.children.forEach((childId) => {
            const child = newNodes[childId];
            newNodes[childId] = {
              ...child,
              path: `${node.path}/${child.name}`,
              updatedAt: Date.now(),
            };
            updateChildrenPaths(childId);
          });
        }
      };
      
      updateChildrenPaths(id);
      
      return {
        fileTree: {
          ...state.fileTree,
          nodes: newNodes,
        },
      };
    });
  },
  
  deleteNode: (id) => {
    set((state) => {
      const node = state.fileTree.nodes[id];
      if (!node) return state;
      
      const newNodes = { ...state.fileTree.nodes };
      
      // Mark as deleted before removing
      newNodes[id] = {
        ...node,
        status: 'deleted',
      };
      
      // Recursively collect all IDs to delete
      const idsToDelete = new Set<string>([id]);
      const collectIds = (nodeId: string) => {
        const node = newNodes[nodeId];
        if (node.type === "folder" && node.children) {
          node.children.forEach((childId) => {
            idsToDelete.add(childId);
            collectIds(childId);
          });
        }
      };
      collectIds(id);
      
      // Delete all collected nodes
      idsToDelete.forEach((id) => delete newNodes[id]);
      
      // Update parent's children
      if (node.parentId && newNodes[node.parentId]) {
        newNodes[node.parentId] = {
          ...newNodes[node.parentId],
          children: newNodes[node.parentId].children?.filter((childId) => childId !== id),
          updatedAt: Date.now(),
        };
      }
      
      // Update root IDs
      const newRootIds = state.fileTree.rootIds.filter((rootId) => rootId !== id);
      
      // Close deleted files
      const newOpenFileIds = state.openFileIds.filter((fileId) => !idsToDelete.has(fileId));
      const newActiveFileId = idsToDelete.has(state.activeFileId || "")
        ? (newOpenFileIds[0] || null)
        : state.activeFileId;
      
      return {
        fileTree: {
          nodes: newNodes,
          rootIds: newRootIds,
        },
        openFileIds: newOpenFileIds,
        activeFileId: newActiveFileId,
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      };
    });
  },
  
  updateFileContent: (id, content, modifiedByAI = false) => {
    set((state) => {
      const node = state.fileTree.nodes[id];
      if (!node || node.type !== "file") return state;
      
      // Determine status: if it's a new file keep 'new', otherwise 'modified'
      const status = node.status === 'new' ? 'new' : 'modified';
      
      return {
        fileTree: {
          ...state.fileTree,
          nodes: {
            ...state.fileTree.nodes,
            [id]: {
              ...node,
              content,
              updatedAt: Date.now(),
              modifiedByAI,
              status,
            },
          },
        },
      };
    });
  },
  
  setFileStatus: (id, status) => {
    set((state) => {
      const node = state.fileTree.nodes[id];
      if (!node) return state;
      
      return {
        fileTree: {
          ...state.fileTree,
          nodes: {
            ...state.fileTree.nodes,
            [id]: {
              ...node,
              status,
            },
          },
        },
      };
    });
  },
});
