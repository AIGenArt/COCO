import { NextResponse } from "next/server";
import { requireUser, unauthorizedResponse } from "../../lib/auth/guards";
import { getGitHubDomainService } from "../../lib/github/github-domain-service";
import { logger } from "../../lib/logger";

export async function GET() {
  try {
    const user = await requireUser();
    const result = await getGitHubDomainService().listAccessibleRepos(user.id);

    return NextResponse.json({
      success: true,
      data: {
        repos: result.repos.map((repo) => ({
          owner: repo.owner,
          repo: repo.repo,
          full_name: repo.fullName,
          private: repo.private,
          default_branch: repo.defaultBranch,
          github_repo_access_id: repo.githubRepoAccessId ?? null
        })),
        source: result.source,
        stale: result.stale
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }

    logger.error({ error }, "Failed to list GitHub repositories");
    return NextResponse.json(
      { success: false, error: { code: "github_repos_failed", message: "Failed to list repositories" } },
      { status: 500 }
    );
  }
}
