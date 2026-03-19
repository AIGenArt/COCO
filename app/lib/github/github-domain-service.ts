import { getWorkspaceById, updateWorkspace } from "../db/workspaces";
import { getInstallationByGithubInstallationId, getInstallationById, listCachedReposForInstallation } from "../db/github";
import { logger } from "../logger";
import { GitHubRateLimitError } from "./github-rate-limiter";
import { getGitHubGateway } from "./github-gateway";
import { getGitHubCacheService } from "./github-cache-service";
import { getGitHubOperationQueue } from "./github-operation-queue";
import { CreatePrInput, CreatePrResult, RepoSummary } from "./types";

export class GitHubDomainService {
  constructor(
    private readonly gateway = getGitHubGateway(),
    private readonly cacheService = getGitHubCacheService(),
    private readonly operationQueue = getGitHubOperationQueue()
  ) {}

  async listAccessibleRepos(userId: string): Promise<{ repos: RepoSummary[]; source: "cache" | "live"; stale: boolean }> {
    const installation = await this.cacheService.getActiveInstallationForUser(userId);
    if (!installation || !installation.is_active) {
      return { repos: [], source: "cache", stale: false };
    }

    const cachedRepos = await this.cacheService.getCachedReposForInstallation(installation.id);
    const stale = this.cacheService.isInstallationStale(installation);

    if (cachedRepos.length > 0 && stale) {
      void this.syncInstallationRepos(installation.github_installation_id).catch((error) => {
        logger.warn({ installationId: installation.id, error }, "Background GitHub repo sync failed");
      });
      return { repos: cachedRepos, source: "cache", stale: true };
    }

    if (cachedRepos.length > 0) {
      return { repos: cachedRepos, source: "cache", stale: false };
    }

    try {
      const repos = await this.syncInstallationRepos(installation.github_installation_id);
      return { repos, source: "live", stale: false };
    } catch (error) {
      if (error instanceof GitHubRateLimitError) {
        await this.cacheService.markInstallationRateLimited(installation.id, error.retryAfterUntil);
        return { repos: cachedRepos, source: "cache", stale: true };
      }
      throw error;
    }
  }

  async syncInstallationRepos(githubInstallationId: number): Promise<RepoSummary[]> {
    const installation = await getInstallationByGithubInstallationIdStrict(githubInstallationId);
    const existingRepos = await listCachedReposForInstallation(installation.id);
    const etag = existingRepos[0]?.etag ?? null;

    return this.operationQueue.run(
      `installation-sync:${githubInstallationId}`,
      async () => {
        logger.info({ githubInstallationId }, "GitHub installation sync started");
        const response = await this.gateway.listInstallationRepos(githubInstallationId, etag);
        if (response.notModified) {
          return this.cacheService.getCachedReposForInstallation(installation.id);
        }

        await this.cacheService.upsertInstallationRepos(installation.id, response.repos, response.etag);
        logger.info({ githubInstallationId, repoCount: response.repos.length }, "GitHub installation sync completed");
        return this.cacheService.getCachedReposForInstallation(installation.id);
      },
      {
        installationId: githubInstallationId,
        userId: installation.user_id,
        type: "sync"
      }
    );
  }

  async createPr(workspaceId: string, userId: string, input: Omit<CreatePrInput, "installationId">): Promise<CreatePrResult> {
    const context = await this.assertWorkspaceGithubAccess(workspaceId, userId);

    return this.operationQueue.run(
      `workspace-write:${workspaceId}`,
      async () => {
        const result = await this.gateway.createPullRequest({
          ...input,
          installationId: context.installation.github_installation_id
        });

        await updateWorkspace(workspaceId, { last_activity_at: new Date().toISOString() });
        return result;
      },
      {
        workspaceId,
        installationId: context.installation.github_installation_id,
        userId,
        type: "write",
        metadata: { action: "create_pr", owner: input.owner, repo: input.repo }
      }
    );
  }

  async pushBranch(workspaceId: string, userId: string): Promise<void> {
    await this.assertWorkspaceGithubAccess(workspaceId, userId);
    await this.operationQueue.run(
      `workspace-write:${workspaceId}`,
      async () => {
        await updateWorkspace(workspaceId, { last_activity_at: new Date().toISOString() });
      },
      {
        workspaceId,
        userId,
        type: "write"
      }
    );
  }

  private async assertWorkspaceGithubAccess(workspaceId: string, userId: string) {
    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace || workspace.user_id !== userId) {
      throw new Error("Workspace not found");
    }

    if (!workspace.github_installation_id || !workspace.github_repo_access_id) {
      throw new Error("Workspace is not linked to GitHub");
    }

    const installation = await getInstallationById(workspace.github_installation_id);
    if (!installation || installation.user_id !== userId || !installation.is_active) {
      throw new Error("GitHub installation is not active for this user");
    }

    return { workspace, installation };
  }
}

async function getInstallationByGithubInstallationIdStrict(githubInstallationId: number) {
  const installation = await getInstallationByGithubInstallationId(githubInstallationId);
  if (!installation) {
    throw new Error("GitHub installation not registered");
  }
  return installation;
}

const githubDomainServiceSingleton = new GitHubDomainService();

export function getGitHubDomainService() {
  return githubDomainServiceSingleton;
}
