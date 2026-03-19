import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "../../../lib/auth/guards";
import { createWorkspace, updateWorkspace } from "../../../lib/db/workspaces";
import { createWorkspaceOperation } from "../../../lib/db/workspace-operations";
import { createWorkspace as createRuntimeWorkspace } from "../../../lib/runtime/runtime-client";

const OpenWorkspaceRequest = z.object({
  name: z.string().min(1),
  type: z.enum(["local", "github_repo"]),
  githubInstallationId: z.string().optional(),
  githubRepoAccessId: z.string().optional()
});

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to open workspace";
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const input = OpenWorkspaceRequest.parse(body);

    const workspace = await createWorkspace({
      userId: user.id,
      type: input.type,
      name: input.name,
      githubInstallationId: input.githubInstallationId ?? null,
      githubRepoAccessId: input.githubRepoAccessId ?? null
    });

    await createWorkspaceOperation({
      workspaceId: workspace.id,
      userId: user.id,
      type: "create",
      initiatedBy: "user",
      metadata: { type: input.type }
    });

    const runtimeResponse = await createRuntimeWorkspace(workspace.id);
    if (!runtimeResponse.success) {
      return NextResponse.json({ success: false, error: runtimeResponse.error }, { status: 500 });
    }

    const updatedWorkspace = await updateWorkspace(workspace.id, {
      runtime_workspace_id: runtimeResponse.data?.sandboxId ?? null,
      status: "created"
    });

    return NextResponse.json({ success: true, data: updatedWorkspace });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: { code: "invalid_request", message: getErrorMessage(error) } },
      { status: 400 }
    );
  }
}