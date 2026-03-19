import { createPrivateKey, KeyObject, sign } from "node:crypto";
import { config } from "../config";
import { logger } from "../logger";
import { getGitHubRateLimiter, GitHubRateLimitError } from "./github-rate-limiter";
import { CreatePrInput, CreatePrResult, GitHubBucketKey, GitHubListReposResponse, RepoSummary } from "./types";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  bucket: GitHubBucketKey;
  retryAttempt?: number;
};

type GitHubGatewayResponse<T> = {
  data: T;
  headers: Headers;
  status: number;
};

export class GitHubGatewayError extends Error {
  constructor(message: string, readonly status: number, readonly headers: Headers) {
    super(message);
    this.name = "GitHubGatewayError";
  }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function importPrivateKey(): KeyObject {
  return createPrivateKey(config.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"));
}

function createAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: config.GITHUB_APP_ID
  };
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsignedToken), importPrivateKey())
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${unsignedToken}.${signature}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class GitHubGateway {
  private readonly apiBaseUrl = "https://api.github.com";
  private readonly rateLimiter = getGitHubRateLimiter();

  async getInstallationToken(installationId: number): Promise<string> {
    const response = await this.request<{ token: string }>(`/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${createAppJwt()}`,
        Accept: "application/vnd.github+json"
      },
      bucket: `installation:${installationId}`
    });

    return response.data.token;
  }

  async getInstallationMetadata(installationId: number): Promise<{ id: number; accountLogin: string; suspendedAt: string | null }> {
    const token = await this.getInstallationToken(installationId);
    const response = await this.request<{ id: number; account: { login: string }; suspended_at: string | null }>(`/installation`, {
      method: "GET",
      headers: { Authorization: `token ${token}` },
      bucket: `installation:${installationId}`
    });

    return {
      id: response.data.id,
      accountLogin: response.data.account.login,
      suspendedAt: response.data.suspended_at
    };
  }

  async listInstallationRepos(installationId: number, etag?: string | null): Promise<GitHubListReposResponse> {
    const token = await this.getInstallationToken(installationId);
    const repos: RepoSummary[] = [];
    let page = 1;
    let capturedEtag: string | null = null;

    while (true) {
      const response = await this.request<{ repositories: Array<{ name: string; full_name: string; private: boolean; default_branch: string | null; owner: { login: string } }> }>(
        `/installation/repositories?per_page=100&page=${page}`,
        {
          method: "GET",
          headers: {
            Authorization: `token ${token}`,
            ...(etag ? { "If-None-Match": etag } : {})
          },
          bucket: `installation:${installationId}`
        }
      );

      if (response.status === 304) {
        return { repos: [], etag: etag ?? null, notModified: true };
      }

      capturedEtag = capturedEtag ?? response.headers.get("etag");
      repos.push(
        ...response.data.repositories.map((repo) => ({
          owner: repo.owner.login,
          repo: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          defaultBranch: repo.default_branch
        }))
      );

      const link = response.headers.get("link");
      if (!link || !link.includes('rel="next"')) {
        break;
      }
      page += 1;
    }

    return { repos, etag: capturedEtag, notModified: false };
  }

  async createPullRequest(input: CreatePrInput): Promise<CreatePrResult> {
    const token = await this.getInstallationToken(input.installationId);
    const response = await this.request<{ number: number; url: string; html_url: string; state: string }>(
      `/repos/${input.owner}/${input.repo}/pulls`,
      {
        method: "POST",
        body: {
          title: input.title,
          body: input.body,
          head: input.head,
          base: input.base
        },
        headers: { Authorization: `token ${token}` },
        bucket: `installation:${input.installationId}`
      }
    );

    return {
      number: response.data.number,
      url: response.data.url,
      htmlUrl: response.data.html_url,
      state: response.data.state
    };
  }

  private async request<T>(path: string, options: RequestOptions): Promise<GitHubGatewayResponse<T>> {
    await this.rateLimiter.beforeRequest(options.bucket);
    const retryAttempt = options.retryAttempt ?? 0;

    try {
      const response = await fetch(`${this.apiBaseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "coco-github-gateway",
          ...(options.headers ?? {})
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });

      await this.rateLimiter.afterResponse(options.bucket, response.headers, response.status);

      if (response.status === 304) {
        return { data: undefined as T, headers: response.headers, status: response.status };
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new GitHubGatewayError(payload?.message ?? `GitHub request failed with status ${response.status}`, response.status, response.headers);
      }

      const data = (await response.json()) as T;
      return { data, headers: response.headers, status: response.status };
    } catch (error) {
      const rateLimitState = await this.rateLimiter.markFailure(options.bucket, error, retryAttempt);
      if (rateLimitState && retryAttempt < 2) {
        const until = rateLimitState.retryAfterUntil ? new Date(rateLimitState.retryAfterUntil).getTime() : null;
        const delayMs = until && until > Date.now() ? until - Date.now() : 2_000;
        logger.warn({ bucket: options.bucket, retryAttempt, delayMs }, "Retrying GitHub request after rate-limit backoff");
        await sleep(delayMs);
        return this.request<T>(path, { ...options, retryAttempt: retryAttempt + 1 });
      }

      if (error instanceof GitHubGatewayError && rateLimitState) {
        throw new GitHubRateLimitError(error.message, rateLimitState.retryAfterUntil);
      }

      throw error;
    }
  }
}

const githubGatewaySingleton = new GitHubGateway();

export function getGitHubGateway() {
  return githubGatewaySingleton;
}
