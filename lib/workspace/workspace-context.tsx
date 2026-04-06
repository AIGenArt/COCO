"use client";

import { createContext, useContext, ReactNode } from "react";
import { useWorkspaceStore } from "./workspace-store";
import { WorkspaceStore } from "./types";

const WorkspaceContext = createContext<WorkspaceStore | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const store = useWorkspaceStore();
  
  return (
    <WorkspaceContext.Provider value={store}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
