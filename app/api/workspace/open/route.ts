import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedResponse } from "../../../lib/auth/guards";
import { getInstallationById, getRepoAccessById } from "../../../lib/db/github";
import { createWorkspace, updateWorkspaceForUser } from "../../../lib/db/workspaces";
import { createWorkspaceOperation } from "../../../lib/db/workspace-operations";
import { logger } from "../../../lib/logger";
import { createWorkspace as createRuntimeWorkspace } from "../../../lib/runtime/runtime-client";

const OpenWorkspaceRequest = z
  .object({
    name: z.string().min(1),
    type: z.enum(["local", "github_repo"]),
    githubInstallationId: z.string().optional(),
    githubRepoAccessId: z.string().optional()
  })
  .superRefine((input, ctx) => {
    if (input.type !== "github_repo") {
      return;
    }

    if (!input.githubInstallationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["githubInstallationId"],
        message: "GitHub installation is required for github_repo workspaces"
      });
    }

    if (!input.githubRepoAccessId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["githubRepoAccessId"],
        message: "GitHub repository access is required for github_repo workspaces"
      });
    }
  });

function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to open workspace";
}

async function assertGitHubWorkspaceAccess(
  input: z.infer<typeof OpenWorkspaceRequest>,
  userId: string
): Promise<void> {
  if (input.type !== "github_repo") {
    return;
  }

  const installation = await getInstallationById(input.githubInstallationId!);
  if (!installation || installation.user_id !== userId || !installation.is_active) {
    throw new Error("GitHub installation is not active for this user");
  }

  const repoAccess = await getRepoAccessById(input.githubRepoAccessId!);
  if (!repoAccess || repoAccess.installation_id !== installation.id || !repoAccess.is_active) {
    throw new Error("GitHub repository access is not active for this installation");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const input = OpenWorkspaceRequest.parse(body);

    await assertGitHubWorkspaceAccess(input, user.id);

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
      logger.error(
        { workspaceId: workspace.id, error: runtimeResponse.error },
        "Failed to provision runtime workspace"
      );
      return NextResponse.json({ success: false, error: runtimeResponse.error }, { status: 500 });
    }

    const updatedWorkspace = await updateWorkspaceForUser(workspace.id, user.id, {
      runtime_workspace_id: runtimeResponse.data?.sandboxId ?? null,
      status: "created"
    });

    return NextResponse.json({ success: true, data: updatedWorkspace });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }

    logger.error({ error }, "Failed to open workspace");
    return NextResponse.json(
      { success: false, error: { code: "invalid_request", message: getErrorMessage(error) } },
      { status: error instanceof z.ZodError ? 422 : 400 }
    );
  }
}