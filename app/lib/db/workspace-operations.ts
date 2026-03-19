import { getSupabaseServiceClient } from "../supabase/server-client";

export type WorkspaceOperationType =
  | "create"
  | "start"
  | "stop"
  | "restart"
  | "install"
  | "clone"
  | "git"
  | "preview";

export type WorkspaceOperationStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export type WorkspaceOperation = {
  id: string;
  workspace_id: string;
  user_id: string;
  type: WorkspaceOperationType;
  status: WorkspaceOperationStatus;
  initiated_by: string;
  metadata?: Record<string, unknown>;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
};

export async function createWorkspaceOperation(input: {
  workspaceId: string;
  userId: string;
  type: WorkspaceOperationType;
  initiatedBy: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("workspace_operations")
    .insert([
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        type: input.type,
        status: "pending",
        initiated_by: input.initiatedBy,
        metadata: input.metadata ?? null
      }
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as WorkspaceOperation;
}
