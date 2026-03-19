alter table github_installations
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_status text not null default 'pending',
  add column if not exists rate_limited_until timestamptz;

alter table github_repo_access
  add column if not exists private boolean not null default true,
  add column if not exists default_branch text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists etag text;

create table if not exists github_webhook_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  event_type text not null,
  processed_at timestamptz,
  status text not null,
  payload_summary jsonb,
  created_at timestamptz not null default now()
);

alter table github_webhook_events enable row level security;

create policy "GitHub webhook events: service role only" on github_webhook_events
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists github_api_buckets (
  bucket_key text primary key,
  remaining integer,
  reset_at timestamptz,
  retry_after_until timestamptz,
  secondary_limited_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table github_api_buckets enable row level security;

create policy "GitHub API buckets: service role only" on github_api_buckets
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

alter table workspaces
  add column if not exists name text not null default 'Workspace';

update github_installations
set sync_status = coalesce(sync_status, 'pending')
where sync_status is null;
