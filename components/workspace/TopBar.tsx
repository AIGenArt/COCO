"use client";

import { Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/workspace/workspace-store";

export function TopBar() {
  const { currentMode, buildStatus, setMode, stopBuild } = useWorkspaceStore();
  
  const isBuilding = buildStatus === "building";
  const canBuild = currentMode === "plan" && buildStatus === "idle";
  
  return (
    <div className="h-12 border-b border-border bg-[#0b0d10] flex items-center justify-between px-4">
      {/* Left: Mode Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-secondary rounded-md p-0.5">
          <button
            onClick={() => setMode("plan")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-colors",
              currentMode === "plan"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            disabled={isBuilding}
          >
            Plan
          </button>
          <button
            onClick={() => setMode("build")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-colors",
              currentMode === "build"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            disabled={!canBuild && currentMode !== "build"}
          >
            Build
          </button>
        </div>
        
        {/* Build Status */}
        {buildStatus !== "idle" && (
          <div className="flex items-center gap-2 ml-4">
            {isBuilding && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-muted-foreground">Building...</span>
              </div>
            )}
            {buildStatus === "done" && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Done</span>
              </div>
            )}
            {buildStatus === "failed" && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-xs text-muted-foreground">Failed</span>
              </div>
            )}
            {buildStatus === "stopped" && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-muted-foreground">Stopped</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Center: Workspace Name */}
      <div className="absolute left-1/2 transform -translate-x-1/2">
        <span className="text-sm font-medium">COCO Workspace</span>
      </div>
      
      {/* Right: Build Controls */}
      <div className="flex items-center gap-2">
        {isBuilding && (
          <button
            onClick={stopBuild}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
          >
            <Square className="w-3 h-3" />
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
