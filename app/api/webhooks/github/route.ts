import { NextResponse } from "next/server";
import { validateWebhookSignature } from "../../../lib/github/github-app";
import { insertWebhookEvent } from "../../../lib/db/github-webhook-events";
import {
  findGitHubInstallationByGitHubId,
  markGitHubInstallationInactive
} from "../../../lib/db/github-installations";
import {
  listActiveReposForInstallation,
  markRepoAccessInactive,
  upsertRepoAccessRecords
} from "../../../lib/db/github-repo-access";
import {
  revokeWorkspacesByInstallationId,
  revokeWorkspacesByRepoAccessId
} from "../../../lib/db/workspaces";

export async function POST(request: Request) {
  const deliveryId = request.headers.get("x-github-delivery") ?? "";
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const eventType = request.headers.get("x-github-event") ?? "";

  const payloadText = await request.text();

  if (!deliveryId || !signature || !eventType) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "invalid_request", message: "Missing required GitHub webhook headers." }
      },
      { status: 400 }
    );
  }

  if (!validateWebhookSignature(payloadText, signature)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "invalid_signature", message: "Invalid GitHub webhook signature." }
      },
      { status: 401 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "invalid_payload", message: "Could not parse webhook payload." }
      },
      { status: 400 }
    );
  }

  const payloadObj = (payload as Record<string, unknown>) ?? {};
  const installationId =
    typeof payload === "object" &&
    payload !== null &&
    payloadObj.installation &&
    typeof payloadObj.installation === "object"
      ? String((payloadObj.installation as Record<string, unknown>).id)
      : null;

  // Persist the incoming webhook for idempotency.
  const existing = await insertWebhookEvent({
    deliveryId,
    eventType,
    installationId,
    payload
  });

  // If this delivery already exists, treat as success.
  if (!existing) {
    return NextResponse.json({ success: true, data: { message: "Duplicate delivery ignored." } });
  }

  try {
    const payloadObj = payload as Record<string, unknown>;
    const action =
      typeof payload === "object" &&
      payload !== null &&
      "action" in payloadObj &&
      typeof payloadObj.action === "string"
        ? payloadObj.action
        : null;

    if (eventType === "installation" && action === "deleted") {
      await handleInstallationDeleted(installationId);
    }

    if (eventType === "installation_repositories") {
      const repositoriesAdded =
        Array.isArray(payloadObj.repositories_added) ? payloadObj.repositories_added : [];
      const repositoriesRemoved =
        Array.isArray(payloadObj.repositories_removed) ? payloadObj.repositories_removed : [];

      if (action === "added" && repositoriesAdded.length > 0) {
        await handleRepositoriesAdded(installationId, repositoriesAdded);
      }

      if (action === "removed" && repositoriesRemoved.length > 0) {
        await handleRepositoriesRemoved(installationId, repositoriesRemoved);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Webhooks should not be retried indefinitely; return 500 so GitHub can retry.
    const message = error instanceof Error ? error.message : "Failed to process webhook.";
    return NextResponse.json(
      {
        success: false,
        error: { code: "processing_error", message }
      },
      { status: 500 }
    );
  }
}

async function handleInstallationDeleted(installationId: string | null) {
  if (!installationId) {
    return;
  }

  const installation = await findGitHubInstallationByGitHubId(installationId);
  if (!installation) {
    return;
  }

  await markGitHubInstallationInactive(installation.id);
  await revokeWorkspacesByInstallationId(installation.id);

  const activeRepos = await listActiveReposForInstallation(installation.id);
  const toDeactivate = activeRepos.map((repo) => ({ owner: repo.owner, repo: repo.repo }));
  await markRepoAccessInactive(installation.id, toDeactivate);
}

type RawGitHubRepo = {
  owner?: { login?: string } | string;
  name?: string;
  full_name?: string;
};

function normalizeRepo(raw: unknown): { owner: string; repo: string; full_name: string } | null {
  if (typeof raw !== "object" || raw === null) return null;

  const repoObj = raw as RawGitHubRepo;
  const name = typeof repoObj.name === "string" ? repoObj.name : null;

  if (!name) return null;

  const ownerValue = repoObj.owner;
  const owner =
    typeof ownerValue === "string"
      ? ownerValue
      : typeof ownerValue === "object" && ownerValue !== null && typeof ownerValue.login === "string"
      ? ownerValue.login
      : null;

  if (!owner) return null;

  const fullName =
    typeof repoObj.full_name === "string" ? repoObj.full_name : `${owner}/${name}`;

  return { owner, repo: name, full_name: fullName };
}

async function handleRepositoriesAdded(installationId: string | null, repositories: unknown[]) {
  if (!installationId || !Array.isArray(repositories) || repositories.length === 0) {
    return;
  }

  const installation = await findGitHubInstallationByGitHubId(installationId);
  if (!installation) {
    return;
  }

  const repos = repositories
    .map(normalizeRepo)
    .filter((repo): repo is { owner: string; repo: string; full_name: string } => repo !== null);

  if (repos.length === 0) {
    return;
  }

  await upsertRepoAccessRecords(installation.id, repos);
}

async function handleRepositoriesRemoved(installationId: string | null, repositories: unknown[]) {
  if (!installationId || !Array.isArray(repositories) || repositories.length === 0) {
    return;
  }

  const installation = await findGitHubInstallationByGitHubId(installationId);
  if (!installation) {
    return;
  }

  const repos = repositories
    .map(normalizeRepo)
    .filter((repo): repo is { owner: string; repo: string; full_name: string } => repo !== null)
    .map((repo) => ({ owner: repo.owner, repo: repo.repo }));

  if (repos.length === 0) {
    return;
  }

  const deactivated = await markRepoAccessInactive(installation.id, repos);

  // Revoke any workspaces that are tied to removed repos
  await Promise.all(deactivated.map((access) => revokeWorkspacesByRepoAccessId(access.id)));
}
