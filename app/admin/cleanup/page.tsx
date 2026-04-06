"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";

interface SandboxItem {
  id: string;
  workspace_id: string;
  workspace_name: string;
  status: string;
  container_id: string | null;
  error_message: string | null;
  created_at: string;
}

export default function CleanupPage() {
  const [sandboxes, setSandboxes] = useState<SandboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadProblematicSandboxes();
  }, []);

  const loadProblematicSandboxes = async () => {
    setLoading(true);
    try {
      // Get all workspaces
      const response = await fetch('/api/workspaces');
      if (!response.ok) {
        throw new Error('Failed to load workspaces');
      }
      
      const data = await response.json();
      const workspaces = data.workspaces || [];
      
      // For each workspace with a sandbox, check its status
      const problematicSandboxes: SandboxItem[] = [];
      
      for (const workspace of workspaces) {
        if (workspace.sandbox_id) {
          try {
            const sandboxResponse = await fetch(`/api/sandboxes/${workspace.sandbox_id}`);
            if (sandboxResponse.ok) {
              const sandboxData = await sandboxResponse.json();
              const sandbox = sandboxData.sandbox;
              
              // Include failed, destroyed, or any non-running sandboxes
              if (sandbox.status !== 'running') {
                problematicSandboxes.push({
                  id: sandbox.id,
                  workspace_id: workspace.id,
                  workspace_name: workspace.name,
                  status: sandbox.status,
                  container_id: sandbox.container_id,
                  error_message: sandbox.error_message,
                  created_at: sandbox.created_at,
                });
              }
            }
          } catch (err) {
            console.error('Error checking sandbox:', err);
          }
        }
      }
      
      setSandboxes(problematicSandboxes);
    } catch (error) {
      console.error('Error loading sandboxes:', error);
    } finally {
      setLoading(false);
    }
  };

  const cleanupSandbox = async (sandboxId: string, deleteWorkspace: boolean) => {
    setCleaning(sandboxId);
    try {
      const url = `/api/sandboxes/${sandboxId}${deleteWorkspace ? '?deleteWorkspace=true' : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cleanup sandbox');
      }

      alert(`✅ ${data.message}`);
      
      // Reload the list
      await loadProblematicSandboxes();
    } catch (error) {
      console.error('Error cleaning up sandbox:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCleaning(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] text-white flex items-center justify-center">
        <p>Loading problematic sandboxes...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Sandbox Cleanup</h1>
            <p className="text-gray-400 mt-2">
              Showing all non-running sandboxes (failed, destroyed, etc.)
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Back to Dashboard
          </Button>
        </div>

        {sandboxes.length === 0 ? (
          <Card className="bg-[#111827] border-[#1F2937] p-8 text-center">
            <p className="text-gray-400">No problematic sandboxes found! 🎉</p>
            <p className="text-sm text-gray-500 mt-2">All sandboxes are running properly</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {sandboxes.map((sandbox) => (
              <Card key={sandbox.id} className="bg-[#111827] border-[#1F2937] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      {sandbox.workspace_name}
                    </h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-400">
                      <div>
                        <span className="text-gray-500">Sandbox ID:</span> {sandbox.id}
                      </div>
                      <div>
                        <span className="text-gray-500">Workspace ID:</span> {sandbox.workspace_id}
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>{' '}
                        <span className={
                          sandbox.status === 'failed' ? 'text-red-500' :
                          sandbox.status === 'destroyed' ? 'text-yellow-500' :
                          'text-orange-500'
                        }>
                          {sandbox.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Container:</span> {sandbox.container_id || 'N/A'}
                      </div>
                      {sandbox.error_message && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Error:</span>{' '}
                          <span className="text-red-400">{sandbox.error_message}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-gray-500">Created:</span> {new Date(sandbox.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => cleanupSandbox(sandbox.id, false)}
                      disabled={cleaning === sandbox.id}
                      variant="outline"
                      size="sm"
                    >
                      {cleaning === sandbox.id ? 'Cleaning...' : 'Clear Sandbox'}
                    </Button>
                    <Button
                      onClick={() => cleanupSandbox(sandbox.id, true)}
                      disabled={cleaning === sandbox.id}
                      variant="destructive"
                      size="sm"
                    >
                      {cleaning === sandbox.id ? 'Cleaning...' : 'Delete All'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Button onClick={loadProblematicSandboxes} variant="outline" className="w-full">
            Refresh List
          </Button>
        </div>
      </div>
    </div>
  );
}
