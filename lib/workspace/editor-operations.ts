import { StateCreator } from "zustand";
import { WorkspaceStore } from "./types";

export interface EditorOperationsSlice {
  openFile: (id: string) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  markFileDirty: (id: string) => void;
  markFileClean: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  expandFolder: (id: string) => void;
  collapseFolder: (id: string) => void;
}

export const createEditorOperationsSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  EditorOperationsSlice
> = (set, get) => ({
  openFile: (id) => {
    set((state) => {
      if (state.openFileIds.includes(id)) {
        return { activeFileId: id };
      }
      
      return {
        openFileIds: [...state.openFileIds, id],
        activeFileId: id,
      };
    });
  },
  
  closeFile: (id) => {
    set((state) => {
      const newOpenFileIds = state.openFileIds.filter((fileId) => fileId !== id);
      const newActiveFileId = state.activeFileId === id
        ? (newOpenFileIds[0] || null)
        : state.activeFileId;
      
      return {
        openFileIds: newOpenFileIds,
        activeFileId: newActiveFileId,
      };
    });
  },
  
  setActiveFile: (id) => {
    set({ activeFileId: id });
  },
  
  markFileDirty: (id) => {
    set((state) => ({
      dirtyFileIds: new Set([...Array.from(state.dirtyFileIds), id]),
    }));
  },
  
  markFileClean: (id) => {
    set((state) => {
      const newDirtyFileIds = new Set(state.dirtyFileIds);
      newDirtyFileIds.delete(id);
      return { dirtyFileIds: newDirtyFileIds };
    });
  },
  
  setSelectedNode: (id) => {
    set({ selectedNodeId: id });
  },
  
  toggleFolder: (id) => {
    set((state) => {
      const newExpandedFolderIds = new Set(state.expandedFolderIds);
      if (newExpandedFolderIds.has(id)) {
        newExpandedFolderIds.delete(id);
      } else {
        newExpandedFolderIds.add(id);
      }
      return { expandedFolderIds: newExpandedFolderIds };
    });
  },
  
  expandFolder: (id) => {
    set((state) => ({
      expandedFolderIds: new Set([...Array.from(state.expandedFolderIds), id]),
    }));
  },
  
  collapseFolder: (id) => {
    set((state) => {
      const newExpandedFolderIds = new Set(state.expandedFolderIds);
      newExpandedFolderIds.delete(id);
      return { expandedFolderIds: newExpandedFolderIds };
    });
  },
});
