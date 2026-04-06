"use client";

import { useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";

/**
 * COCO Preview Browser
 * 
 * Embedded preview using Next.js API proxy to avoid cross-origin restrictions.
 * Proxies localhost:3000 through /api/preview for seamless embedded experience.
 * 
 * Phase 2: Will proxy sandbox URLs (ws-{id}.coco.dev)
 * See: docs/sandbox-architecture.md
 */

interface SimplePreviewProps {
  workspaceId?: string; // Future: unique workspace ID for sandbox
}

export function SimplePreview({ workspaceId }: SimplePreviewProps) {
  const [key, setKey] = useState(0);
  const previewUrl = workspaceId 
    ? `/api/preview/${workspaceId}/` 
    : "/api/preview"; // Fallback to COCO's own preview

  const handleRefresh = () => {
    // Force iframe reload by changing key
    setKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    // Open preview in new tab
    if (workspaceId) {
      window.open(`/api/preview/${workspaceId}/`, '_blank', 'noopener,noreferrer');
    } else {
      window.open('http://localhost:3000', '_blank', 'noopener,noreferrer');
    }
  };

  // Show loading state for workspace preview
  if (workspaceId && !previewUrl.includes(workspaceId)) {
    return (
      <div className="w-full h-full flex flex-col bg-[#0b0d10]">
        <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-[#0b0d10]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Preview</span>
            <span className="text-xs text-muted-foreground">Waiting for dev server...</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-muted-foreground">Starting dev server...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0d10]">
      {/* Preview Header */}
      <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-[#0b0d10]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Preview</span>
          <span className="text-xs text-muted-foreground">
            {workspaceId ? `workspace:${workspaceId.slice(0, 8)}` : 'localhost:3000'}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="w-7 h-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleOpenExternal}
            className="w-7 h-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Preview Iframe */}
      <div className="flex-1 relative overflow-hidden">
        <iframe
          key={key}
          src={previewUrl}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          title="Preview"
        />
      </div>
    </div>
  );
}
