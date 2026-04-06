"use client";

import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";

type ViewMode = "code" | "preview" | "split";

interface ViewModeBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeBar({ viewMode, onViewModeChange }: ViewModeBarProps) {
  const handleBack = () => {
    // TODO: Implement navigation history
    console.log("Navigate back");
  };
  
  const handleForward = () => {
    // TODO: Implement navigation history
    console.log("Navigate forward");
  };
  
  const handleRefresh = () => {
    // TODO: Implement refresh
    console.log("Refresh");
  };
  
  return (
    <div className="h-10 border-b border-border flex items-center px-3 gap-3 bg-[#0b0d10]">
      {/* View Mode Tabs */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onViewModeChange("code")}
          className={`px-3 h-7 rounded text-sm font-medium transition-colors ${
            viewMode === "code"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          Code
        </button>
        <button
          onClick={() => onViewModeChange("preview")}
          className={`px-3 h-7 rounded text-sm font-medium transition-colors ${
            viewMode === "preview"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          Preview
        </button>
        <button
          onClick={() => onViewModeChange("split")}
          className={`px-3 h-7 rounded text-sm font-medium transition-colors ${
            viewMode === "split"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          Split
        </button>
      </div>
      
      {/* Divider */}
      <div className="w-px h-5 bg-border" />
      
      {/* Navigation Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleBack}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handleForward}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Go forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleRefresh}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Refresh"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
      
      {/* Divider */}
      <div className="w-px h-5 bg-border" />
      
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>/workspace</span>
      </div>
    </div>
  );
}
