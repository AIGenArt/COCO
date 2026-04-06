"use client";

import { RefreshCw, Loader2, AlertCircle, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSandboxLifecycle } from "@/lib/sandbox/use-sandbox-lifecycle";

interface PreviewProps {
  workspaceId: string;
}

export function Preview({ workspaceId }: PreviewProps) {
  const [key, setKey] = useState(0);

  const { state, startSandbox, retrySandbox, isLoading, isReady, isFailed } = useSandboxLifecycle({
    workspaceId,
    onReady: (url) => {
      console.log('[Preview] Sandbox ready:', url);
    },
    onError: (error) => {
      console.error('[Preview] Sandbox error:', error);
    },
  });

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  const handleStartSandbox = () => {
    startSandbox();
  };

  const handleRetry = () => {
    retrySandbox();
  };

  return (
    <div className="h-full flex flex-col bg-[#0B0F14]">
      {/* Preview Toolbar */}
      <div className="h-12 border-b border-[#1F2937] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Preview</span>
          {state.previewUrl && (
            <span className="text-xs text-gray-500">{state.previewUrl}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isReady && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-8"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 bg-white relative">
        {/* Idle State - Show Start Button */}
        {state.status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Play className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Start Sandbox
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Launch an isolated Next.js environment
                </p>
                <Button onClick={handleStartSandbox} size="lg">
                  <Play className="w-4 h-4 mr-2" />
                  Start Sandbox
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State - Show Spinner with Status */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {state.statusMessage}
                </h3>
                <p className="text-sm text-gray-600">
                  {state.status === 'creating' && 'Setting up your environment...'}
                  {state.status === 'installing' && 'This may take a minute...'}
                  {state.status === 'booting' && 'Almost ready...'}
                </p>
              </div>
              {/* Progress Steps */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <div className={`w-2 h-2 rounded-full ${
                  ['creating', 'starting', 'installing', 'booting', 'running'].includes(state.status)
                    ? 'bg-blue-600'
                    : 'bg-gray-300'
                }`} />
                <div className={`w-2 h-2 rounded-full ${
                  ['starting', 'installing', 'booting', 'running'].includes(state.status)
                    ? 'bg-blue-600'
                    : 'bg-gray-300'
                }`} />
                <div className={`w-2 h-2 rounded-full ${
                  ['installing', 'booting', 'running'].includes(state.status)
                    ? 'bg-blue-600'
                    : 'bg-gray-300'
                }`} />
                <div className={`w-2 h-2 rounded-full ${
                  ['booting', 'running'].includes(state.status)
                    ? 'bg-blue-600'
                    : 'bg-gray-300'
                }`} />
                <div className={`w-2 h-2 rounded-full ${
                  state.status === 'running'
                    ? 'bg-blue-600'
                    : 'bg-gray-300'
                }`} />
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
            <div className="text-center space-y-4 max-w-md px-4">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Sandbox Failed
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {state.error || 'An error occurred while starting the sandbox'}
                </p>
                <Button onClick={handleRetry} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Running State - Show Preview */}
        {isReady && state.previewUrl && (
          <iframe
            key={key}
            src={state.previewUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="Preview"
          />
        )}
      </div>
    </div>
  );
}
