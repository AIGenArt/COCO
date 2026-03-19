import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service";
process.env.GITHUB_APP_ID ??= "1";
process.env.GITHUB_APP_CLIENT_ID ??= "client";
process.env.GITHUB_APP_CLIENT_SECRET ??= "secret";
process.env.GITHUB_APP_PRIVATE_KEY ??= "-----BEGIN PRIVATE KEY-----\\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAx0KZfakefakefake\\n-----END PRIVATE KEY-----";
process.env.GITHUB_APP_WEBHOOK_SECRET ??= "webhook-secret";
process.env.NEXTAUTH_URL ??= "https://example.com";
process.env.NEXTAUTH_SECRET ??= "nextauth-secret-nextauth-secret-123";
process.env.RUNTIME_SERVICE_URL ??= "https://runtime.example.com";
process.env.RUNTIME_SERVICE_SECRET ??= "runtime-secret-runtime-secret-123";

test("webhook signature validation accepts valid sha256 signatures", async () => {
  const { computeGitHubWebhookSignature, verifyGitHubWebhookSignature } = await import("../lib/github/github-webhooks");
  const payload = JSON.stringify({ zen: "Design for retries" });
  const signature = computeGitHubWebhookSignature(payload, "webhook-secret");

  assert.equal(verifyGitHubWebhookSignature(payload, signature, "webhook-secret"), true);
  assert.equal(verifyGitHubWebhookSignature(payload, "sha256=invalid", "webhook-secret"), false);
});

test("duplicate webhook deliveries are idempotent", async () => {
  const { createGitHubWebhookProcessor } = await import("../lib/github/github-webhooks");
  let insertCalls = 0;
  const processor = createGitHubWebhookProcessor({
    insertWebhookEvent: async () => {
      insertCalls += 1;
      return { inserted: insertCalls === 1, record: null };
    },
    updateWebhookEventStatus: async () => undefined,
    getInstallationByGithubInstallationId: async () => ({
      id: "inst_1",
      user_id: "user_1",
      github_installation_id: 42,
      account_login: "octo",
      access_type: "all",
      is_active: true,
      last_synced_at: null,
      sync_status: "ok",
      rate_limited_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }),
    createAuditLog: async () => undefined,
    cacheService: {
      markInstallationRevoked: async () => undefined,
      markReposAdded: async () => undefined,
      markReposRemoved: async () => undefined
    }
  });

  const first = await processor({ deliveryId: "delivery-1", eventType: "installation.deleted", payload: { installation: { id: 42 } } });
  const second = await processor({ deliveryId: "delivery-1", eventType: "installation.deleted", payload: { installation: { id: 42 } } });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
});

test("repo listing prefers cache and only triggers background sync when stale", async () => {
  const { GitHubDomainService } = await import("../lib/github/github-domain-service");
  let syncCalls = 0;
  const service = new GitHubDomainService(
    {} as never,
    {
      getActiveInstallationForUser: async () => ({
        id: "inst-db-1",
        user_id: "user-1",
        github_installation_id: 42,
        account_login: "octo",
        access_type: "all",
        is_active: true,
        last_synced_at: new Date(Date.now() - 120_000).toISOString(),
        sync_status: "ok",
        rate_limited_until: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }),
      getCachedReposForInstallation: async () => [
        { owner: "octo", repo: "repo", fullName: "octo/repo", private: true, defaultBranch: "main", githubRepoAccessId: "repo_1" }
      ],
      isInstallationStale: () => true,
      markInstallationRateLimited: async () => undefined
    } as never,
    { run: async (_key: string, task: () => Promise<unknown>) => task() } as never
  );

  (service as unknown as { syncInstallationRepos: (githubInstallationId: number) => Promise<unknown> }).syncInstallationRepos = async () => {
    syncCalls += 1;
    return [];
  };

  const result = await service.listAccessibleRepos("user-1");

  assert.equal(result.source, "cache");
  assert.equal(result.stale, true);
  assert.equal(result.repos.length, 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(syncCalls, 1);
});

test("repo listing falls back to cache when GitHub is rate-limited", async () => {
  const { GitHubDomainService } = await import("../lib/github/github-domain-service");
  const { GitHubRateLimitError } = await import("../lib/github/github-rate-limiter");
  let markedUntil: string | null = null;
  const service = new GitHubDomainService(
    {} as never,
    {
      getActiveInstallationForUser: async () => ({
        id: "inst-db-1",
        user_id: "user-1",
        github_installation_id: 42,
        account_login: "octo",
        access_type: "all",
        is_active: true,
        last_synced_at: null,
        sync_status: "pending",
        rate_limited_until: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }),
      getCachedReposForInstallation: async () => [],
      isInstallationStale: () => true,
      markInstallationRateLimited: async (_installationId: string, until: string | null) => {
        markedUntil = until;
      }
    } as never,
    { run: async (_key: string, task: () => Promise<unknown>) => task() } as never
  );

  (service as unknown as { syncInstallationRepos: (githubInstallationId: number) => Promise<unknown> }).syncInstallationRepos = async () => {
    throw new GitHubRateLimitError("secondary rate limit", new Date(Date.now() + 30_000).toISOString());
  };

  const result = await service.listAccessibleRepos("user-1");

  assert.equal(result.source, "cache");
  assert.equal(result.repos.length, 0);
  assert.notEqual(markedUntil, null);
});


test("unsupported webhook events are ignored before any DB write", async () => {
  const { createGitHubWebhookProcessor } = await import("../lib/github/github-webhooks");
  let insertCalls = 0;
  const processor = createGitHubWebhookProcessor({
    insertWebhookEvent: async () => {
      insertCalls += 1;
      return { inserted: true, record: null };
    },
    updateWebhookEventStatus: async () => undefined,
    getInstallationByGithubInstallationId: async () => null,
    createAuditLog: async () => undefined,
    cacheService: {
      markInstallationRevoked: async () => undefined,
      markReposAdded: async () => undefined,
      markReposRemoved: async () => undefined
    }
  });

  const result = await processor({
    deliveryId: "delivery-unsupported",
    eventType: "push",
    payload: { installation: { id: 42 } }
  });

  assert.equal(result.duplicate, false);
  assert.equal(insertCalls, 0);
});

test("installation_repositories added event only applies added repos", async () => {
  const { createGitHubWebhookProcessor } = await import("../lib/github/github-webhooks");
  const addedCalls: Array<Array<{ fullName: string }>> = [];
  let removedCalls = 0;

  const processor = createGitHubWebhookProcessor({
    insertWebhookEvent: async () => ({ inserted: true, record: null }),
    updateWebhookEventStatus: async () => undefined,
    getInstallationByGithubInstallationId: async () => ({
      id: "inst_1",
      user_id: "user_1",
      github_installation_id: 42,
      account_login: "octo",
      access_type: "all",
      is_active: true,
      last_synced_at: null,
      sync_status: "ok",
      rate_limited_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }),
    createAuditLog: async () => undefined,
    cacheService: {
      markInstallationRevoked: async () => undefined,
      markReposAdded: async (_installationId: string, repos: Array<{ fullName: string }>) => {
        addedCalls.push(repos);
      },
      markReposRemoved: async () => {
        removedCalls += 1;
      }
    }
  });

  await processor({
    deliveryId: "delivery-added-only",
    eventType: "installation_repositories",
    payload: {
      installation: { id: 42 },
      repositories_added: [
        { name: "repo-a", full_name: "octo/repo-a", owner: { login: "octo" } },
        { name: "repo-b", full_name: "octo/repo-b", owner: { login: "octo" } }
      ]
    }
  });

  assert.equal(addedCalls.length, 1);
  assert.deepEqual(addedCalls[0].map((repo) => repo.fullName), ["octo/repo-a", "octo/repo-b"]);
  assert.equal(removedCalls, 0);
});
