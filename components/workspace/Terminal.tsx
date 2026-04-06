"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from "lucide-react";
import { useWorkspaceStore } from "@/lib/workspace/workspace-store";

interface TerminalLog {
  id: string;
  type: "info" | "success" | "error" | "command";
  message: string;
  timestamp: number;
}

// Helper: Format relative time (Henosia-style)
function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 10) return "now";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export function Terminal() {
  const [logs, setLogs] = useState<TerminalLog[]>([
    {
      id: "welcome",
      type: "info",
      message: "COCO Terminal ready",
      timestamp: Date.now(),
    },
  ]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { buildStatus, activeBuildSession } = useWorkspaceStore();
  
  // Client-only rendering
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);
  
  // Listen to build status changes
  useEffect(() => {
    if (buildStatus === "building") {
      addLog("info", "Build started...");
    } else if (buildStatus === "done") {
      addLog("success", "✓ Build completed successfully");
    } else if (buildStatus === "failed") {
      addLog("error", "✗ Build failed");
    } else if (buildStatus === "stopped") {
      addLog("info", "Build stopped by user");
    }
  }, [buildStatus]);
  
  // Listen to affected files
  useEffect(() => {
    if (activeBuildSession && activeBuildSession.filesAffected.length > 0) {
      const lastFileId = activeBuildSession.filesAffected[activeBuildSession.filesAffected.length - 1];
      // In a real implementation, we'd get the file path from the store
      addLog("info", `Updated file: ${lastFileId}`);
    }
  }, [activeBuildSession?.filesAffected.length]);
  
  const addLog = (type: TerminalLog["type"], message: string) => {
    setLogs(prev => [
      ...prev,
      {
        id: `log_${Date.now()}_${Math.random()}`,
        type,
        message,
        timestamp: Date.now(),
      },
    ]);
  };
  
  const clearLogs = () => {
    setLogs([
      {
        id: "cleared",
        type: "info",
        message: "Terminal cleared",
        timestamp: Date.now(),
      },
    ]);
  };
  
  return (
    <div
      className={`border-t border-border bg-[#0b0d10] flex flex-col transition-all duration-200 ${
        isExpanded ? "h-96" : "h-32"
      }`}
    >
      {/* Header */}
      <div className="h-8 border-b border-border flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearLogs}
            className="w-6 h-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-6 h-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      
      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-0.5">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`flex gap-2 ${
              log.type === "error"
                ? "text-red-400"
                : log.type === "success"
                ? "text-green-400"
                : log.type === "command"
                ? "text-blue-400"
                : "text-muted-foreground"
            }`}
          >
            <span className="text-muted-foreground min-w-[2.5rem]">
              {mounted ? timeAgo(log.timestamp) : "..."}
            </span>
            <span>{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
