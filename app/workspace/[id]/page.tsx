"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { IconRail } from "@/components/workspace/IconRail";
import { TaskPanel } from "@/components/workspace/TaskPanel";
import { ViewModeBar } from "@/components/workspace/ViewModeBar";
import { Explorer } from "@/components/workspace/Explorer";
import { EditorTabs } from "@/components/workspace/EditorTabs";
import { CodeEditor } from "@/components/workspace/CodeEditor";
import { BottomPanel } from "@/components/workspace/BottomPanel";
import { StatusBar } from "@/components/workspace/StatusBar";
import { Preview } from "@/components/workspace/Preview";
import { useWorkspaceStore } from "@/lib/workspace/workspace-store";
import { useSandboxStatus } from "@/lib/sandbox/use-sandbox-status";
import { useSandboxHeartbeat } from "@/lib/sandbox/use-sandbox-heartbeat";
import { useWorkspaceAutoSave } from "@/lib/workspace/use-workspace-auto-save";
import type { SandboxInstance } from "@/lib/sandbox/types";

type ViewMode = "code" | "preview" | "split";

export default function WorkspacePage({ params }: { params: { id: string } }) {
  const workspaceId = params.id;
  const router = useRouter();

  const {
    activeFileId,
    getNodeById,
    updateFileContent,
    markFileDirty,
    expandFolder,
    fileTree,
  } = useWorkspaceStore();

  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [isCreatingSandbox, setIsCreatingSandbox] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState<'loading' | 'starting' | 'running' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);

  // CRITICAL: Prevent double init from React Strict Mode
  const initStartedRef = useRef(false);

  // Validate workspace ID
  useEffect(() => {
    if (!workspaceId) {
      setError('No workspace ID provided');
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }
  }, [workspaceId, router]);

  // If no workspace ID, show error
  if (!workspaceId) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0B0F14] text-white">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-500">No Workspace ID</h1>
          <p className="text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Sandbox status polling
  const { sandbox, isPolling, error: sandboxError } = useSandboxStatus({
    sandboxId,
    enabled: !!sandboxId,
    onStatusChange: (updatedSandbox: SandboxInstance) => {
      console.log('Sandbox status changed:', updatedSandbox.status);
    },
  });

  // Sandbox heartbeat (only when running)
  useSandboxHeartbeat({
    sandboxId,
    workspaceId: workspaceId || '',
    status: sandbox?.status || null,
    enabled: !!sandboxId && !!workspaceId,
  });

  // Auto-save integration
  const { saveBeforeSandboxStart } = useWorkspaceAutoSave({
    workspaceId: workspaceId || '',
    metadata: {
      id: workspaceId || '',
      name: 'Workspace', // TODO: Get from workspace data
      description: null,
      template: 'nextjs', // Valid template: nextjs, react, vue, or vanilla
    },
    onSave: async (metadata) => {
      // Save workspace metadata
      if (!workspaceId) return;
      
      // Only send fields that exist in database schema
      const { id, ...updateData } = metadata;
      
      await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
    },
    enabled: !!workspaceId,
  });

  // Create sandbox
  const handleCreateSandbox = async () => {
    if (!workspaceId || isCreatingSandbox) return;

    setIsCreatingSandbox(true);
    try {
      // 1. Save workspace metadata first
      await saveBeforeSandboxStart();

      // 2. Create sandbox
      const response = await fetch('/api/sandboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create sandbox');
      }

      const data = await response.json();
      setSandboxId(data.sandbox.id);

      // 3. Start sandbox
      await handleStartSandbox(data.sandbox.id);

    } catch (error) {
      console.error('Error creating sandbox:', error);
      alert(error instanceof Error ? error.message : 'Failed to create sandbox');
    } finally {
      setIsCreatingSandbox(false);
    }
  };

  // Start sandbox
  const handleStartSandbox = async (id?: string) => {
    const targetId = id || sandboxId;
    if (!targetId) return;

    try {
      const response = await fetch(`/api/sandboxes/${targetId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start sandbox');
      }

      console.log('Sandbox starting...');
    } catch (error) {
      console.error('Error starting sandbox:', error);
      alert(error instanceof Error ? error.message : 'Failed to start sandbox');
    }
  };

  // Stop sandbox
  const handleStopSandbox = async () => {
    if (!sandboxId) return;

    try {
      const response = await fetch(`/api/sandboxes/${sandboxId}/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to stop sandbox');
      }

      console.log('Sandbox stopping...');
    } catch (error) {
      console.error('Error stopping sandbox:', error);
      alert(error instanceof Error ? error.message : 'Failed to stop sandbox');
    }
  };

  // Auto-expand root folders on mount
  useEffect(() => {
    fileTree.rootIds.forEach((rootId) => {
      expandFolder(rootId);
    });
  }, []);

  // Auto-start sandbox on mount
  useEffect(() => {
    if (!workspaceId || initStartedRef.current) {
      console.log('[Workspace] Init blocked by guard');
      return;
    }
    
    initStartedRef.current = true;
    console.log('[Workspace] Init guard set - preventing double init');

    const initializeSandbox = async () => {
      try {
        setSandboxStatus('loading');
        
        console.log(`[Workspace] ========================================`);
        console.log(`[Workspace] Initializing sandbox for workspace ${workspaceId}...`);
        console.log(`[Workspace] Timestamp: ${new Date().toISOString()}`);
        console.log(`[Workspace] ========================================`);
        
        const response = await fetch('/api/sandboxes/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId }),
        });

        console.log(`[Workspace] Response status: ${response.status}`);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[Workspace] Error response:', errorData);
          throw new Error(errorData.details || errorData.error || 'Failed to create sandbox');
        }

        const data = await response.json();
        console.log('[Workspace] ✓ Sandbox created:', data.sandbox.id);
        console.log('[Workspace] Status:', data.sandbox.status);
        
        // Set sandbox ID for polling
        setSandboxId(data.sandbox.id);
        setSandboxStatus('starting');

      } catch (error) {
        console.error('[Workspace] ========================================');
        console.error('[Workspace] ✗ Error initializing sandbox');
        console.error('[Workspace] Error:', error);
        console.error('[Workspace] ========================================');
        
        // Provide more helpful error messages
        let errorMessage = 'Failed to initialize sandbox';
        if (error instanceof Error) {
          if (error.message.includes('fetch')) {
            errorMessage = 'Network error: Could not connect to server. Please check your connection and try again.';
          } else if (error.message.includes('E2B')) {
            errorMessage = `E2B Error: ${error.message}`;
          } else {
            errorMessage = error.message;
          }
        }
        
        setSandboxStatus('failed');
        setError(errorMessage);
      }
    };

    void initializeSandbox();
  }, [workspaceId]);

  const activeFile = activeFileId ? getNodeById(activeFileId) : null;
  const code = activeFile?.content || "";

  const handleCodeChange = (newCode: string | undefined) => {
    if (activeFileId && newCode !== undefined) {
      updateFileContent(activeFileId, newCode);
      markFileDirty(activeFileId);
    }
  };

  const handleCursorChange = (position: { line: number; column: number }) => {
    setCursorPosition(position);
  };

  // Determine language from file extension
  const getLanguage = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TypeScript JSX",
      js: "JavaScript",
      jsx: "JavaScript JSX",
      json: "JSON",
      css: "CSS",
      html: "HTML",
      md: "Markdown",
    };
    return languageMap[ext || ""] || "Plain Text";
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Loading/Error Overlay */}
      {(sandboxStatus === 'loading' || sandboxStatus === 'starting') && (
        <div className="absolute inset-0 bg-[#0B0F14]/90 z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {sandboxStatus === 'loading' ? 'Creating workspace...' : 'Starting dev server...'}
              </h2>
              <p className="text-gray-400 mt-2">
                {sandboxStatus === 'loading' 
                  ? 'Extracting template and installing dependencies...' 
                  : 'This may take a minute...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Disabled Notice - Non-blocking */}
      {sandboxStatus === 'failed' && error && (
        <div className="absolute top-4 right-4 z-50 max-w-md">
          <div className="bg-yellow-900/90 border border-yellow-600 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="text-yellow-500 text-2xl">ℹ️</div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-200">Preview Temporarily Disabled</h3>
                <p className="text-xs text-yellow-300 mt-1">{error}</p>
                <p className="text-xs text-yellow-400 mt-2">
                  You can still use the code editor. Preview will be re-enabled soon.
                </p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-yellow-400 hover:text-yellow-200 text-xl leading-none"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Icon Rail */}
        <IconRail />

        {/* Task Panel */}
        <TaskPanel />

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col">
          {/* View Mode Bar (Code/Preview/Split) */}
          <ViewModeBar viewMode={viewMode} onViewModeChange={setViewMode} />

          {/* Content Area - Changes based on view mode */}
          <div className="flex-1 flex overflow-hidden">
            {/* Code View */}
            {(viewMode === "code" || viewMode === "split") && (
              <div className={`flex ${viewMode === "split" ? "w-1/2" : "w-full"} border-r border-border`}>
                {/* Explorer */}
                <Explorer />

                {/* Editor */}
                <div className="flex-1 flex flex-col">
                  {/* Editor Tabs */}
                  <EditorTabs />

                  {/* Monaco Editor */}
                  <div className="flex-1">
                    {activeFile ? (
                      <CodeEditor
                        value={code}
                        onChange={handleCodeChange}
                        onCursorChange={handleCursorChange}
                        path={activeFile.path}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p className="text-sm">No file selected</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Preview View */}
            {(viewMode === "preview" || viewMode === "split") && (
              <div className={viewMode === "split" ? "w-1/2" : "w-full"}>
                <Preview workspaceId={workspaceId} />
              </div>
            )}
          </div>

          {/* Bottom Panel (Problems/Output/Debug/Terminal) */}
          <BottomPanel />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        cursorPosition={cursorPosition}
        indentation={2}
        encoding="UTF-8"
        lineEnding="LF"
        language={activeFile ? getLanguage(activeFile.name) : "Plain Text"}
        errors={0}
        warnings={0}
      />
    </div>
  );
}
