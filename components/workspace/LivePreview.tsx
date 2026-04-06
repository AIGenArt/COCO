"use client";

import { useEffect, useState } from "react";
import { 
  SandpackProvider, 
  SandpackPreview,
  SandpackFiles 
} from "@codesandbox/sandpack-react";
import { previewService } from "@/lib/workspace/preview-service";
import { RefreshCw } from "lucide-react";

export function LivePreview() {
  const [files, setFiles] = useState<SandpackFiles>({});
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Initial load
    const initialFiles = previewService.getFiles();
    setFiles(initialFiles);
    setIsLoading(false);
    
    // Subscribe to updates
    const unsubscribe = previewService.onUpdate((updatedFiles) => {
      setFiles(updatedFiles);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  const handleRefresh = () => {
    previewService.refresh();
  };
  
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0b0d10]">
        <div className="text-muted-foreground">Loading preview...</div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex flex-col bg-[#0b0d10]">
      {/* Preview Header */}
      <div className="h-10 border-b border-border flex items-center justify-between px-4">
        <span className="text-sm font-medium">Live Preview</span>
        <button
          onClick={handleRefresh}
          className="w-7 h-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh preview"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      {/* Sandpack Preview */}
      <div className="flex-1 overflow-hidden">
        <SandpackProvider
          template="react-ts"
          files={files}
          theme="dark"
          options={{
            externalResources: [
              "https://cdn.tailwindcss.com"
            ],
            autorun: true,
            autoReload: true,
          }}
          customSetup={{
            dependencies: {
              "react": "^18.2.0",
              "react-dom": "^18.2.0",
            }
          }}
        >
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
            style={{
              height: "100%",
              border: "none",
            }}
          />
        </SandpackProvider>
      </div>
    </div>
  );
}
