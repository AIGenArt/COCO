import "server-only";
import { getSupabaseServiceClient } from "../supabase/server-client";
import { PreviewStatus, WorkspaceStatus, WorkspaceType } from "../../../types/workspace";

export type WorkspaceCreateInput = {
  userId: string;
  type: WorkspaceType;
  name: string;
  githubInstallationId?: string | null;
  githubRepoAccessId?: string | null;
};

export type WorkspaceRecord = {
  id: string;
  user_id: string;
  name: string;
  github_installation_id: string | null;
  github_repo_access_id: string | null;
  type: WorkspaceType;
  status: WorkspaceStatus;
  preview_status: PreviewStatus;
  runtime_workspace_id: string | null;
  port: number | null;
  created_at: string;
  last_activity_at: string;
  stopped_at: string | null;
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

  return data as WorkspaceRecord;
}

export async function getWorkspaceById(workspaceId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("workspaces").select("*").eq("id", workspaceId).maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as WorkspaceRecord | null) ?? null;
}

export async function getWorkspaceByIdForUser(workspaceId: string, userId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as WorkspaceRecord | null) ?? null;
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

  return data as WorkspaceRecord;
}

export async function updateWorkspaceForUser(workspaceId: string, userId: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    throw new Error("Workspace not found");
  }

  return data as WorkspaceRecord;
}
