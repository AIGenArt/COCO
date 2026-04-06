"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Plus, Trash2, Clock, User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  template: string;
  created_at: string;
  updated_at: string;
}

export default function DashboardPage() {
  const [prompt, setPrompt] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    loadUserAndWorkspaces();
  }, []);

  const loadUserAndWorkspaces = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      setUser(user);
      
      const response = await fetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      } else {
        console.error('Failed to load workspaces:', response.status);
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!prompt.trim()) return;
    
    setIsCreating(true);
    
    try {
      // 1. Create workspace in database
      const workspaceResponse = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prompt.trim().slice(0, 100),
          description: prompt.trim(),
          template: 'nextjs',
        }),
      });

      const workspaceData = await workspaceResponse.json();

      if (!workspaceResponse.ok) {
        if (workspaceResponse.status === 403) {
          toast({
            title: "Workspace limit reached",
            description: "Maximum 2 workspaces. Delete one to create new.",
            variant: "destructive",
          });
        } else {
          throw new Error(workspaceData.error || 'Failed to create workspace');
        }
        return;
      }

      const workspaceId = workspaceData.workspace.id;

      toast({
        title: "Workspace created",
        description: "Setting up development environment...",
      });

      // 2. Create sandbox and start dev server
      const sandboxResponse = await fetch('/api/sandboxes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (!sandboxResponse.ok) {
        const sandboxError = await sandboxResponse.json();
        console.error('Sandbox creation failed:', sandboxError);
        // Continue anyway - user can try to start it later
        toast({
          title: "Warning",
          description: "Workspace created but dev server failed to start",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ready!",
          description: "Your workspace is ready",
        });
      }

      // 3. Navigate to workspace
      router.push(`/workspace/${workspaceId}`);
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast({
        title: "Error",
        description: "Failed to create workspace. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWorkspace = async (id: string, name: string) => {
    if (!confirm(`Delete workspace "${name}"?`)) return;

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workspace');
      }

      toast({
        title: "Workspace deleted",
        description: `"${name}" has been deleted.`,
      });

      setWorkspaces(workspaces.filter(w => w.id !== id));
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        title: "Error",
        description: "Failed to delete workspace.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const canCreateWorkspace = workspaces.length < 2;

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      {/* Top Bar */}
      <div className="border-b border-[#1F2937]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold">COCO</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {workspaces.length} / 2 workspaces
            </span>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#1F2937] hover:bg-[#111827]"
                >
                  <User className="w-4 h-4 mr-2" />
                  {user?.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Existing Workspaces */}
        {workspaces.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Your Workspaces</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workspaces.map((workspace) => (
                <Card
                  key={workspace.id}
                  className="bg-[#111827] border-[#1F2937] p-6 hover:border-blue-600 transition-all cursor-pointer group"
                  onClick={() => router.push(`/workspace/${workspace.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold group-hover:text-blue-500 transition-colors">
                      {workspace.name}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWorkspace(workspace.id, workspace.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {workspace.description && (
                    <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                      {workspace.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(workspace.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Create New Workspace */}
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold">
              {workspaces.length === 0 ? "What do you want to build?" : "Create New Workspace"}
            </h2>
            <p className="text-lg text-gray-400">
              {canCreateWorkspace 
                ? "Describe your project and let AI help you build it"
                : "Delete a workspace to create a new one (max 2 workspaces)"
              }
            </p>
          </div>

          <div className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Build a landing page with pricing section..."
              className="min-h-[120px] bg-[#111827] border-[#1F2937] text-white placeholder:text-gray-500 resize-none text-lg"
              disabled={!canCreateWorkspace}
            />
            
            <Button 
              size="lg" 
              onClick={handleCreateWorkspace}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={!prompt.trim() || !canCreateWorkspace || isCreating}
            >
              <Plus className="mr-2 w-4 h-4" />
              {isCreating ? "Creating..." : "Create Workspace"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
