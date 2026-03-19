import "server-only";
import { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "../supabase/server-client";
import {
  GitHubApiBucketRecord,
  GitHubBucketKey,
  GitHubInstallationRecord,
  GitHubRepoAccessRecord,
  GitHubWebhookEventRecord,
  RepoSummary
} from "../github/types";

function isNoRowsError(error: PostgrestError | null): boolean {
  return !!error && error.code === "PGRST116";
}

export async function getActiveInstallationForUser(userId: string): Promise<GitHubInstallationRecord | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_installations")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return (data as GitHubInstallationRecord | null) ?? null;
}

export async function getInstallationByGithubInstallationId(githubInstallationId: number) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_installations")
    .select("*")
    .eq("github_installation_id", githubInstallationId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return (data as GitHubInstallationRecord | null) ?? null;
}

export async function getInstallationById(installationId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_installations")
    .select("*")
    .eq("id", installationId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return (data as GitHubInstallationRecord | null) ?? null;
}


export async function getRepoAccessById(repoAccessId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_repo_access")
    .select("*")
    .eq("id", repoAccessId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return (data as GitHubRepoAccessRecord | null) ?? null;
}

export async function listCachedReposForInstallation(installationId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_repo_access")
    .select("*")
    .eq("installation_id", installationId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as GitHubRepoAccessRecord[];
}


export async function upsertRepoAccessRecords(installationId: string, repos: RepoSummary[], etag?: string | null): Promise<void> {
  if (repos.length === 0) {
    return;
  }

  const supabase = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("github_repo_access").upsert(
    repos.map((repo) => ({
      installation_id: installationId,
      owner: repo.owner,
      repo: repo.repo,
      full_name: repo.fullName,
      private: repo.private,
      default_branch: repo.defaultBranch,
      etag: etag ?? null,
      is_active: true,
      last_seen_at: now,
      updated_at: now
    })),
    { onConflict: "installation_id,owner,repo" }
  );

  if (error) {
    throw error;
  }
}

export async function upsertInstallationRepos(installationId: string, repos: RepoSummary[], etag?: string | null): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const seenKeys = new Set(repos.map((repo) => `${repo.owner}/${repo.repo}`.toLowerCase()));

  await upsertRepoAccessRecords(installationId, repos, etag);

  const existing = await listCachedReposForInstallationAnyState(installationId);
  const toDeactivate = existing
    .filter((repo) => !seenKeys.has(`${repo.owner}/${repo.repo}`.toLowerCase()))
    .map((repo) => repo.id);

  if (toDeactivate.length > 0) {
    const { error } = await supabase
      .from("github_repo_access")
      .update({ is_active: false, updated_at: now })
      .in("id", toDeactivate);

    if (error) {
      throw error;
    }
  }

  await updateInstallationSyncState(installationId, {
    last_synced_at: now,
    sync_status: "ok",
    rate_limited_until: null,
    updated_at: now
  });
}

export async function listCachedReposForInstallationAnyState(installationId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_repo_access")
    .select("*")
    .eq("installation_id", installationId);

  if (error) {
    throw error;
  }

  return (data ?? []) as GitHubRepoAccessRecord[];
}

export async function markInstallationRevoked(installationId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const now = new Date().toISOString();

  const { error: installationError } = await supabase
    .from("github_installations")
    .update({ is_active: false, sync_status: "revoked", updated_at: now })
    .eq("id", installationId);

  if (installationError) {
    throw installationError;
  }

  const { error: repoError } = await supabase
    .from("github_repo_access")
    .update({ is_active: false, updated_at: now })
    .eq("installation_id", installationId);

  if (repoError) {
    throw repoError;
  }
}

export async function markReposAccessState(input: {
  installationId: string;
  fullNames: string[];
  isActive: boolean;
}) {
  if (input.fullNames.length === 0) {
    return;
  }

  const supabase = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("github_repo_access")
    .update({ is_active: input.isActive, updated_at: now, last_seen_at: now })
    .eq("installation_id", input.installationId)
    .in("full_name", input.fullNames);

  if (error) {
    throw error;
  }
}

export async function updateInstallationSyncState(
  installationId: string,
  updates: Partial<Pick<GitHubInstallationRecord, "last_synced_at" | "sync_status" | "rate_limited_until" | "updated_at">>
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("github_installations").update(updates).eq("id", installationId);

  if (error) {
    throw error;
  }
}

export async function getBucketState(bucketKey: GitHubBucketKey): Promise<GitHubApiBucketRecord | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("github_api_buckets")
    .select("*")
    .eq("bucket_key", bucketKey)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return (data as GitHubApiBucketRecord | null) ?? null;
}

export async function upsertBucketState(state: GitHubApiBucketRecord): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("github_api_buckets").upsert(state, { onConflict: "bucket_key" });

  if (error) {
    throw error;
  }
}

export async function insertWebhookEvent(input: {
  deliveryId: string;
  eventType: string;
  status: string;
  payloadSummary: Record<string, unknown> | null;
}): Promise<{ inserted: boolean; record: GitHubWebhookEventRecord | null }> {
  const supabase = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("github_webhook_events")
    .insert({
      delivery_id: input.deliveryId,
      event_type: input.eventType,
      status: input.status,
      payload_summary: input.payloadSummary,
      processed_at: input.status === "processed" ? now : null
    })
    .select("*")
    .maybeSingle();

  if (!error) {
    return { inserted: true, record: data as GitHubWebhookEventRecord };
  }

  if (error.code === "23505") {
    return { inserted: false, record: null };
  }

  throw error;
}

export async function updateWebhookEventStatus(deliveryId: string, status: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("github_webhook_events")
    .update({ status, processed_at: new Date().toISOString() })
    .eq("delivery_id", deliveryId);

  if (error) {
    throw error;
  }
}

export async function createAuditLog(input: {
  userId?: string | null;
  workspaceId?: string | null;
  event: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("audit_logs").insert({
    user_id: input.userId ?? null,
    workspace_id: input.workspaceId ?? null,
    event: input.event,
    metadata: input.metadata ?? null
  });

  if (error) {
    throw error;
  }
}
