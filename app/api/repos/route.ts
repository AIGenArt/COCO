import { NextResponse } from "next/server";
import { requireUser } from "../../lib/auth/guards";
import { getActiveGitHubInstallationByUser } from "../../lib/db/github-installations";
import { listActiveReposForInstallation } from "../../lib/db/github-repo-access";

export async function GET() {
  try {
    const user = await requireUser();

    const installation = await getActiveGitHubInstallationByUser(user.id);
    if (!installation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "no_installation",
            message: "No active GitHub App installation found for this user."
          }
        },
        { status: 404 }
      );
    }

    const repos = await listActiveReposForInstallation(installation.id);

    return NextResponse.json({ success: true, data: { repos } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list repositories.";
    return NextResponse.json(
      {
        success: false,
        error: { code: "unexpected_error", message }
      },
      { status: 500 }
    );
  }
}
