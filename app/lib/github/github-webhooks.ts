import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getGitHubServerConfig } from "../config/server";
import { createAuditLog, getInstallationByGithubInstallationId, insertWebhookEvent, updateWebhookEventStatus } from "../db/github";
import { logger } from "../logger";
import { getGitHubCacheService } from "./github-cache-service";
import { RepoSummary } from "./types";

export function computeGitHubWebhookSignature(payload: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function verifyGitHubWebhookSignature(payload: string, signatureHeader: string | null, secret = getGitHubServerConfig().GITHUB_APP_WEBHOOK_SECRET): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = Buffer.from(computeGitHubWebhookSignature(payload, secret));
  const actual = Buffer.from(signatureHeader);
  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

type WebhookPayload = {
  installation?: { id: number };
  repositories_added?: Array<{ name: string; full_name: string; private?: boolean; default_branch?: string | null; owner?: { login: string } }>;
  repositories_removed?: Array<{ full_name: string }>;
};

const SUPPORTED_WEBHOOK_EVENTS = new Set(["installation.deleted", "installation_repositories"]);

type WebhookProcessorDeps = {
  insertWebhookEvent: typeof insertWebhookEvent;
  updateWebhookEventStatus: typeof updateWebhookEventStatus;
  getInstallationByGithubInstallationId: typeof getInstallationByGithubInstallationId;
  createAuditLog: typeof createAuditLog;
  cacheService: Pick<ReturnType<typeof getGitHubCacheService>, "markInstallationRevoked" | "markReposAdded" | "markReposRemoved">;
};

export function createGitHubWebhookProcessor(deps: WebhookProcessorDeps) {
  return async function processGitHubWebhook(input: {
    deliveryId: string;
    eventType: string;
    payload: WebhookPayload;
  }): Promise<{ duplicate: boolean }> {
    if (!SUPPORTED_WEBHOOK_EVENTS.has(input.eventType)) {
      logger.info({ deliveryId: input.deliveryId, eventType: input.eventType }, "Ignoring unsupported GitHub webhook event");
      return { duplicate: false };
    }

    const summary = buildPayloadSummary(input.payload);
    const insertResult = await deps.insertWebhookEvent({
      deliveryId: input.deliveryId,
      eventType: input.eventType,
      status: "received",
      payloadSummary: summary
    });

    if (!insertResult.inserted) {
      logger.info({ deliveryId: input.deliveryId, eventType: input.eventType }, "Duplicate GitHub webhook ignored");
      return { duplicate: true };
    }

    try {
      await handleWebhookEvent(deps, input.eventType, input.payload);
      await deps.updateWebhookEventStatus(input.deliveryId, "processed");
      logger.info({ deliveryId: input.deliveryId, eventType: input.eventType }, "GitHub webhook processed");
      return { duplicate: false };
    } catch (error) {
      await deps.updateWebhookEventStatus(input.deliveryId, "failed");
      logger.error({ deliveryId: input.deliveryId, eventType: input.eventType, error }, "GitHub webhook processing failed");
      throw error;
    }
  };
}

export const processGitHubWebhook = createGitHubWebhookProcessor({
  insertWebhookEvent,
  updateWebhookEventStatus,
  getInstallationByGithubInstallationId,
  createAuditLog,
  cacheService: getGitHubCacheService()
});

async function handleWebhookEvent(deps: WebhookProcessorDeps, eventType: string, payload: WebhookPayload): Promise<void> {
  const githubInstallationId = payload.installation?.id;
  if (!githubInstallationId) {
    return;
  }

  const installation = await deps.getInstallationByGithubInstallationId(githubInstallationId);
  if (!installation) {
    return;
  }

  if (eventType === "installation.deleted") {
    await deps.cacheService.markInstallationRevoked(installation.id);
    await deps.createAuditLog({
      userId: installation.user_id,
      event: "github.installation.revoked",
      metadata: { installationId: installation.id, githubInstallationId }
    });
    return;
  }

  if (eventType === "installation_repositories") {
    const addedRepos = normalizeRepos(payload.repositories_added ?? []);
    const removedRepos = (payload.repositories_removed ?? []).map((repo) => repo.full_name);

    if (addedRepos.length > 0) {
      await deps.cacheService.markReposAdded(installation.id, addedRepos);
    }

    if (removedRepos.length > 0) {
      await deps.cacheService.markReposRemoved(installation.id, removedRepos);
      await deps.createAuditLog({
        userId: installation.user_id,
        event: "github.repo_access.revoked",
        metadata: { installationId: installation.id, removedRepos }
      });
    }
  }
}

function normalizeRepos(repositories: NonNullable<WebhookPayload["repositories_added"]>): RepoSummary[] {
  return repositories.map((repo) => ({
    owner: repo.owner?.login ?? repo.full_name.split("/")[0] ?? "unknown",
    repo: repo.name,
    fullName: repo.full_name,
    private: Boolean(repo.private),
    defaultBranch: repo.default_branch ?? null
  }));
}

function buildPayloadSummary(payload: WebhookPayload): Record<string, unknown> {
  return {
    installationId: payload.installation?.id ?? null,
    repositoriesAdded: payload.repositories_added?.map((repo) => repo.full_name) ?? [],
    repositoriesRemoved: payload.repositories_removed?.map((repo) => repo.full_name) ?? []
  };
}
