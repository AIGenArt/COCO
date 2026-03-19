import "server-only";
import crypto from "crypto";
import { Octokit } from "@octokit/rest";
import { App } from "@octokit/app";
import { createAppAuth } from "@octokit/auth-app";
import { logger } from "../logger";
import { getGitHubServerConfig } from "../config/server";

export interface GitHubAppTokenResponse {
  token: string;
  expiresAt: string;
  permissions: Record<string, string | undefined>;
  repositories?: Array<{ id: number; name: string; full_name: string }>;
}

export function normalizePrivateKey(privateKey: string) {
  if (privateKey.includes("BEGIN PRIVATE KEY")) {
    return privateKey;
  }
  return Buffer.from(privateKey, "base64").toString("utf-8");
}

export async function createAppAuthenticatedClient(installationId?: number) {
  try {
    const config = getGitHubServerConfig();
    const privateKey = normalizePrivateKey(config.GITHUB_APP_PRIVATE_KEY);

    const app = new App({
      appId: config.GITHUB_APP_ID,
      privateKey,
      webhooks: {
        secret: config.GITHUB_APP_WEBHOOK_SECRET
      }
    });

    if (installationId) {
      return await app.getInstallationOctokit(installationId);
    }

    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.GITHUB_APP_ID,
        privateKey
      }
    });
  } catch (error) {
    logger.error({ error }, "Failed to create GitHub App authenticated client");
    throw error;
  }
}

export async function getInstallationToken(installationId: number): Promise<GitHubAppTokenResponse> {
  try {
    const config = getGitHubServerConfig();
    const privateKey = normalizePrivateKey(config.GITHUB_APP_PRIVATE_KEY);

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.GITHUB_APP_ID,
        privateKey
      }
    });

    const response = await octokit.rest.apps.createInstallationAccessToken({
      installation_id: installationId
    });

    return {
      token: response.data.token,
      expiresAt: response.data.expires_at,
      permissions: (response.data.permissions ?? {}) as Record<string, string | undefined>,
      repositories: "repositories" in response.data ? response.data.repositories : undefined
    };
  } catch (error) {
    logger.error({ error, installationId }, "Failed to get installation token");
    throw error;
  }
}

export function validateWebhookSignature(payload: string | Buffer, signature: string) {
  try {
    const config = getGitHubServerConfig();
    const hmac = crypto.createHmac("sha256", config.GITHUB_APP_WEBHOOK_SECRET);
    hmac.update(payload);
    const expectedSignature = "sha256=" + hmac.digest("hex");

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) {
    logger.warn({ error }, "Webhook signature validation failed");
    return false;
  }
}

export function getInstallationIdFromWebhook(payload: any): number | null {
  return payload?.installation?.id ?? null;
}

export function createOctokitWithToken(token: string) {
  return new Octokit({ auth: token });
}

export async function getAppInstallation(owner: string, repo: string) {
  try {
    const config = getGitHubServerConfig();
    const privateKey = normalizePrivateKey(config.GITHUB_APP_PRIVATE_KEY);

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.GITHUB_APP_ID,
        privateKey
      }
    });

    const response = await octokit.rest.apps.getRepoInstallation({ owner, repo });

    return {
      id: response.data.id,
      access_tokens_url: response.data.access_tokens_url
    };
  } catch (error) {
    logger.error({ error, owner, repo }, "Failed to get app installation");
    throw error;
  }
}

export function createGitHubApp() {
  try {
    const config = getGitHubServerConfig();
    const privateKey = normalizePrivateKey(config.GITHUB_APP_PRIVATE_KEY);

    return new App({
      appId: config.GITHUB_APP_ID,
      privateKey,
      webhooks: {
        secret: config.GITHUB_APP_WEBHOOK_SECRET
      }
    });
  } catch (error) {
    logger.error({ error }, "Failed to create GitHub App instance");
    throw error;
  }
}