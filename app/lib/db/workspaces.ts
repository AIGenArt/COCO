import { getSupabaseServiceClient } from "../supabase/server-client";
import { Workspace, WorkspaceStatus, PreviewStatus, WorkspaceType } from "../../../types/workspace";

export type WorkspaceCreateInput = {
  userId: string;
  type: WorkspaceType;
  name: string;
  githubInstallationId?: string | null;
  githubRepoAccessId?: string | null;
};

export async function createWorkspace(input: WorkspaceCreateInput) {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("workspaces")
    .insert([
      {
        user_id: input.userId,
        type: input.type,
        name: input.name,
        github_installation_id: input.githubInstallationId,
        github_repo_access_id: input.githubRepoAccessId,
        status: "created",
        preview_status: "waiting"
      }
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Workspace;
}

export async function getWorkspaceById(workspaceId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (error) {
    throw error;
  }

  return data as Workspace | null;
}

export async function updateWorkspace(workspaceId: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", workspaceId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Workspace;
}
