"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  template: string;
  created_at: string;
  updated_at: string;
}

export default function WorkspacePickerPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      const response = await fetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      } else {
        throw new Error('Failed to load workspaces');
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
      setError(error instanceof Error ? error.message : 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkspaceClick = (workspaceId: string) => {
    router.push(`/workspace/${workspaceId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
          <p className="text-white">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-5xl">⚠️</div>
          <h1 className="text-2xl font-bold text-white">Error Loading Workspaces</h1>
          <p className="text-gray-400">{error}</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">No Workspaces Yet</h1>
            <p className="text-gray-400">Create your first workspace to get started</p>
          </div>
          <Button 
            onClick={() => router.push('/dashboard')}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          >
            Create Workspace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      {/* Header */}
      <div className="border-b border-[#1F2937]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Select a Workspace</h1>
              <p className="text-gray-400">Choose a workspace to open in the editor</p>
            </div>
            <Button 
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="border-[#1F2937] hover:bg-[#111827]"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workspaces.map((workspace) => (
            <Card
              key={workspace.id}
              className="bg-[#111827] border-[#1F2937] p-6 hover:border-blue-600 transition-all cursor-pointer group"
              onClick={() => handleWorkspaceClick(workspace.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold group-hover:text-blue-500 transition-colors mb-2">
                    {workspace.name}
                  </h3>
                  {workspace.description && (
                    <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                      {workspace.description}
                    </p>
                  )}
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0 ml-4" />
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-[#1F2937]">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>
                    Updated {new Date(workspace.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {workspace.template}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Helper Text */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Click on a workspace card to open it in the editor
          </p>
        </div>
      </div>
    </div>
  );
}
