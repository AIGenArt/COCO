"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/workspace/workspace-store";

export function EditorTabs() {
  const {
    openFileIds,
    activeFileId,
    dirtyFileIds,
    getNodeById,
    setActiveFile,
    closeFile,
  } = useWorkspaceStore();

  return (
    <div className="h-8 bg-[#0b0d10] border-b border-border flex items-center overflow-x-auto">
      {openFileIds.map((fileId) => {
        const node = getNodeById(fileId);
        if (!node) return null;

        const isActive = activeFileId === fileId;
        const isDirty = dirtyFileIds.has(fileId);

        return (
          <div
            key={fileId}
            className={cn(
              "h-full flex items-center gap-2 px-3 border-r border-border cursor-pointer group",
              "hover:bg-secondary transition-colors",
              isActive && "bg-[#0f1115]"
            )}
            onClick={() => setActiveFile(fileId)}
          >
            <span
              className={cn(
                "text-xs",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {node.name}
            </span>
            {isDirty && <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(fileId);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-secondary rounded p-0.5 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
