export type WorkspaceStatus =
  | "created"
  | "cloning"
  | "installing"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error"
  | "revoked";

export type PreviewStatus = "waiting" | "ready" | "failed";

export type WorkspaceType = "local" | "github_repo";

export interface Workspace {
  id: string;
  userId: string;
  githubInstallationId: string | null;
  githubRepoAccessId: string | null;
  type: WorkspaceType;
  status: WorkspaceStatus;
  previewStatus: PreviewStatus;
  runtimeWorkspaceId: string | null;
  port: number | null;
  createdAt: string;
  lastActivityAt: string;
  stoppedAt: string | null;
}
