"use client";

import { useState } from "react";
import { Terminal as TerminalComponent } from "./Terminal";
import { X } from "lucide-react";

type PanelTab = "problems" | "output" | "debug" | "terminal";

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>("terminal");
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="h-[200px] border-t border-border flex flex-col bg-[#0b0d10]">
      {/* Tab Bar */}
      <div className="h-9 border-b border-border flex items-center justify-between px-2">
        <div className="flex items-center">
          <button
            onClick={() => setActiveTab("problems")}
            className={`px-3 h-7 text-xs font-medium transition-colors ${
              activeTab === "problems"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            PROBLEMS
          </button>
          <button
            onClick={() => setActiveTab("output")}
            className={`px-3 h-7 text-xs font-medium transition-colors ${
              activeTab === "output"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            OUTPUT
          </button>
          <button
            onClick={() => setActiveTab("debug")}
            className={`px-3 h-7 text-xs font-medium transition-colors ${
              activeTab === "debug"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            DEBUG CONSOLE
          </button>
          <button
            onClick={() => setActiveTab("terminal")}
            className={`px-3 h-7 text-xs font-medium transition-colors ${
              activeTab === "terminal"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            TERMINAL
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setIsVisible(false)}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "problems" && <ProblemsPanel />}
        {activeTab === "output" && <OutputPanel />}
        {activeTab === "debug" && <DebugConsolePanel />}
        {activeTab === "terminal" && <TerminalComponent />}
      </div>
    </div>
  );
}

function ProblemsPanel() {
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="text-sm text-muted-foreground">
        No problems detected
      </div>
    </div>
  );
}

function OutputPanel() {
  return (
    <div className="h-full p-4 overflow-auto font-mono text-xs">
      <div className="text-muted-foreground">
        <div>[COCO] Build started...</div>
        <div>[COCO] Watching for file changes...</div>
      </div>
    </div>
  );
}

function DebugConsolePanel() {
  return (
    <div className="h-full p-4 overflow-auto font-mono text-xs">
      <div className="text-muted-foreground">
        Debug console ready
      </div>
    </div>
  );
}
