-- Initial migration for COCO Supabase schema
-- This migration creates core tables and RLS policies for the AI coding workspace platform.

-- Profiles (linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  github_id text not null unique,
  github_login text not null,
  github_avatar_url text,
  tier text not null default 'free',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Profiles: owner can manage own profile" on profiles
  for all using (auth.uid() = id);

-- GitHub Installations (per user)
create table if not exists github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  github_installation_id bigint not null unique,
  account_login text not null,
  access_type text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table github_installations enable row level security;
create policy "GitHub installations: owner" on github_installations
  for all using (auth.uid() = user_id);

-- GitHub Repo Access (tracks repos user can access via installation)
create table if not exists github_repo_access (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references github_installations(id) on delete cascade,
  owner text not null,
  repo text not null,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installation_id, owner, repo)
);

alter table github_repo_access enable row level security;
create policy "GitHub repo access: installation owner" on github_repo_access
  for all using (
    exists (
      select 1 from github_installations gi
      where gi.id = github_repo_access.installation_id
        and gi.user_id = auth.uid()
    )
  );

-- GitHub webhook events (for idempotency and audit)
create table if not exists github_webhook_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  event_type text not null,
  installation_id bigint,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table github_webhook_events enable row level security;
create policy "GitHub webhook events: service role" on github_webhook_events
  for all using (auth.role() = 'service_role');

-- Workspaces
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  github_installation_id uuid references github_installations(id),
  github_repo_access_id uuid references github_repo_access(id),
  type text not null,
  status text not null default 'created',
  preview_status text not null default 'waiting',
  runtime_workspace_id text,
  port int,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  stopped_at timestamptz
);

alter table workspaces enable row level security;
create policy "Workspaces: owners" on workspaces
  for all using (auth.uid() = user_id);

-- Workspace operations
create table if not exists workspace_operations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  status text not null default 'pending',
  initiated_by text not null,
  metadata jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

alter table workspace_operations enable row level security;
create policy "Workspace operations: owners" on workspace_operations
  for all using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_operations.workspace_id
        and w.user_id = auth.uid()
    )
  );

-- Workspace logs
create table if not exists workspace_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  level text not null,
  source text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table workspace_logs enable row level security;
create policy "Workspace logs: read own" on workspace_logs
  for select using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_logs.workspace_id
        and w.user_id = auth.uid()
    )
  );

-- AI runs
create table if not exists ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  mode text not null,
  prompt text not null,
  response text,
  actions_proposed jsonb,
  actions_applied jsonb,
  created_at timestamptz not null default now()
);

alter table ai_runs enable row level security;
create policy "AI runs: owners" on ai_runs
  for all using (
    exists (
      select 1 from workspaces w
      where w.id = ai_runs.workspace_id
        and w.user_id = auth.uid()
    )
  );

-- Audit logs (service role only)
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  workspace_id uuid references workspaces(id),
  event text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;
create policy "Audit logs: service role" on audit_logs
  for all using (auth.role() = 'service_role');
