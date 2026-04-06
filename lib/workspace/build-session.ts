import { StateCreator } from "zustand";
import { WorkspaceStore, WorkspaceMode } from "./types";

export interface BuildSessionSlice {
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
  canEdit: () => boolean;
}

export const createBuildSessionSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  BuildSessionSlice
> = (set, get) => ({
  setMode: (mode) => {
    set({ currentMode: mode });
  },
  
  startBuild: (buildId) => {
    set({
      buildStatus: "building",
      activeBuildSession: {
        id: buildId,
        status: "building",
        startedAt: Date.now(),
        actions: [],
        filesAffected: [],
      },
      lockedByAI: true,
    });
  },
  
  stopBuild: () => {
    set((state) => ({
      buildStatus: "stopping",
      activeBuildSession: state.activeBuildSession
        ? { ...state.activeBuildSession, status: "stopping" }
        : null,
    }));
    
    // Complete the stop after a brief delay
    setTimeout(() => {
      set((state) => ({
        buildStatus: "stopped",
        activeBuildSession: state.activeBuildSession
          ? {
              ...state.activeBuildSession,
              status: "stopped",
              completedAt: Date.now(),
            }
          : null,
        lockedByAI: false,
      }));
    }, 100);
  },
  
  completeBuild: (success, error) => {
    set((state) => ({
      buildStatus: success ? "done" : "failed",
      activeBuildSession: state.activeBuildSession
        ? {
            ...state.activeBuildSession,
            status: success ? "done" : "failed",
            completedAt: Date.now(),
            error,
          }
        : null,
      lockedByAI: false,
    }));
  },
  
  lockEditor: () => {
    set({ lockedByAI: true });
  },
  
  unlockEditor: () => {
    set({ lockedByAI: false });
  },
  
  markPreviewDirty: () => {
    set({ pendingPreviewRefresh: true });
  },
  
  markPreviewClean: () => {
    set({ pendingPreviewRefresh: false });
  },
  
  addBuildAction: (actionId) => {
    set((state) => {
      if (!state.activeBuildSession) return state;
      
      return {
        activeBuildSession: {
          ...state.activeBuildSession,
          actions: [...state.activeBuildSession.actions, actionId],
        },
      };
    });
  },
  
  addAffectedFile: (fileId) => {
    set((state) => {
      if (!state.activeBuildSession) return state;
      
      return {
        activeBuildSession: {
          ...state.activeBuildSession,
          filesAffected: [...state.activeBuildSession.filesAffected, fileId],
        },
      };
    });
  },
  
  canEdit: () => {
    const state = get();
    return !state.lockedByAI && state.buildStatus !== "building";
  },
});
