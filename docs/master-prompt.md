# Master Prompt

This repository implements a **secure, sandboxed AI coding workspace platform** with a strong focus on **isolation**, **authorization**, and **persistent architecture documentation**.

## Core Architecture

The platform is intentionally split into three strictly separated layers:

1. **Netlify (Frontend + API)**
   - Hosts the Next.js web UI and API routes.
   - Contains all UI logic and client-side session handling.
   - Never calls GitHub or runtime services directly with tokens.

2. **Supabase (Auth + Database + Realtime)**
   - Auth: GitHub login via Supabase Auth provider.
   - Database: Postgres with strict Row-Level Security (RLS).
   - Realtime: status/events for workspaces, logs, and preview updates.
   - Storage: only where required for user assets.

3. **Runtime Service (Sandbox Execution)**
   - Independent Node.js service responsible for isolated code execution.
   - Runs user workspaces in sandboxed environments.
   - Handles npm install, dev server, command execution and previews.
   - Communicates with Netlify layer via internal REST API (authenticated by shared secret).

---

## GitHub App Model

- **Auth (Identity)** is handled by Supabase Auth (GitHub provider)
- **Permissions** are enforced via **GitHub App** installations
- All repository access is granted through GitHub App installation tokens
- The frontend never sees GitHub tokens; all GitHub actions are proxied through backend services.

---

## Workspace System

Workspaces represent isolated project environments for a given user and repo.

Key points:

- Workspace state is persisted in Supabase.
- Runtime state is managed by the Runtime Service.
- Workspaces are always tied to:
  - A user (Supabase profile)
  - A GitHub installation
  - A repo access record

Workflow:

1. User requests workspace creation through UI.
2. Netlify API authenticates the user and validates ownership.
3. Netlify writes workspace state to Supabase.
4. Netlify calls Runtime Service to create sandbox and start the workspace.
5. Runtime Service reports status and logs back to Supabase.
6. Preview is exposed via a proxied URL (never `localhost` in the browser).

---

## AI System Rules

- AI is **mocked in MVP**.
- AI **cannot execute code** or access tokens directly.
- AI may propose structured actions (e.g., patch file, run command) which are validated before execution.
- All AI output goes through `action-validator.ts`.
- AI context is sanitized to remove secrets and sensitive data.
- AI actions must be audited and logged in `ai_runs`.
