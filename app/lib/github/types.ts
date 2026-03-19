export type GitHubBucketKey = `installation:${number}` | `user:${string}`;

export type RateLimitState = {
  remaining: number | null;
  resetAt: string | null;
  retryAfterUntil: string | null;
  secondaryLimitedUntil: string | null;
};

export type RepoSummary = {
  owner: string;
  repo: string;
  fullName: string;
  private: boolean;
  defaultBranch: string | null;
  installationId?: string;
  githubRepoAccessId?: string;
  updatedAt?: string;
};

export type GitHubInstallationRecord = {
  id: string;
  user_id: string;
  github_installation_id: number;
  account_login: string;
  access_type: string;
  is_active: boolean;
  last_synced_at: string | null;
  sync_status: string | null;
  rate_limited_until: string | null;
  created_at: string;
  updated_at: string;
};

export type GitHubRepoAccessRecord = {
  id: string;
  installation_id: string;
  owner: string;
  repo: string;
  full_name: string;
  private: boolean;
  default_branch: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  etag: string | null;
  created_at: string;
  updated_at: string;
};

export type GitHubWebhookEventRecord = {
  id: string;
  delivery_id: string;
  event_type: string;
  processed_at: string | null;
  status: string;
  payload_summary: Record<string, unknown> | null;
  created_at: string;
};

export type GitHubApiBucketRecord = {
  bucket_key: GitHubBucketKey;
  remaining: number | null;
  reset_at: string | null;
  retry_after_until: string | null;
  secondary_limited_until: string | null;
  updated_at: string;
};

export type GitHubListReposResponse = {
  repos: RepoSummary[];
  etag: string | null;
  notModified: boolean;
};

export type CreatePrInput = {
  installationId: number;
  owner: string;
  repo: string;
  title: string;
  body?: string;
  head: string;
  base: string;
};

export type CreatePrResult = {
  number: number;
  url: string;
  htmlUrl: string;
  state: string;
};
