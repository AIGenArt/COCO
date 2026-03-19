import {
  getActiveInstallationForUser,
  getInstallationById,
  listCachedReposForInstallation,
  listCachedReposForInstallationAnyState,
  markInstallationRevoked,
  markReposAccessState,
  updateInstallationSyncState,
  upsertInstallationRepos
} from "../db/github";
import { logger } from "../logger";
import { GitHubInstallationRecord, RepoSummary } from "./types";

const DEFAULT_STALE_MS = 60_000;

export class GitHubCacheService {
  async getActiveInstallationForUser(userId: string): Promise<GitHubInstallationRecord | null> {
    return getActiveInstallationForUser(userId);
  }

  async getAccessibleRepos(userId: string): Promise<RepoSummary[]> {
    const installation = await getActiveInstallationForUser(userId);
    if (!installation) {
      return [];
    }

    const repos = await listCachedReposForInstallation(installation.id);
    return repos.map((repo) => ({
      owner: repo.owner,
      repo: repo.repo,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      installationId: installation.id,
      githubRepoAccessId: repo.id,
      updatedAt: repo.updated_at
    }));
  }

  async getCachedReposForInstallation(installationId: string): Promise<RepoSummary[]> {
    const repos = await listCachedReposForInstallation(installationId);
    return repos.map((repo) => ({
      owner: repo.owner,
      repo: repo.repo,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      installationId,
      githubRepoAccessId: repo.id,
      updatedAt: repo.updated_at
    }));
  }

  async hasCachedRepos(installationId: string): Promise<boolean> {
    const repos = await listCachedReposForInstallationAnyState(installationId);
    return repos.length > 0;
  }

  isInstallationStale(installation: GitHubInstallationRecord, staleMs = DEFAULT_STALE_MS): boolean {
    if (!installation.last_synced_at) {
      return true;
    }

    return Date.now() - new Date(installation.last_synced_at).getTime() > staleMs;
  }

  async upsertInstallationRepos(installationId: string, repos: RepoSummary[], etag?: string | null): Promise<void> {
    await upsertInstallationRepos(installationId, repos, etag);
  }

  async markInstallationRevoked(installationId: string): Promise<void> {
    logger.warn({ installationId }, "Marking GitHub installation as revoked");
    await markInstallationRevoked(installationId);
  }

  async markReposAdded(installationId: string, repos: RepoSummary[]): Promise<void> {
    await upsertInstallationRepos(installationId, repos, null);
  }

  async markReposRemoved(installationId: string, fullNames: string[]): Promise<void> {
    await markReposAccessState({ installationId, fullNames, isActive: false });
  }

  async markInstallationRateLimited(installationId: string, until: string | null): Promise<void> {
    await updateInstallationSyncState(installationId, {
      rate_limited_until: until,
      sync_status: "rate_limited",
      updated_at: new Date().toISOString()
    });
  }

  async getInstallation(installationId: string) {
    return getInstallationById(installationId);
  }
}

const githubCacheServiceSingleton = new GitHubCacheService();

export function getGitHubCacheService() {
  return githubCacheServiceSingleton;
}
