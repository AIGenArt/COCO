# Security

This project is designed around a zero-trust model with strict isolation, least privilege, and mandatory authorization checks.

## Row-Level Security (RLS)

All database tables have Row-Level Security enabled. RLS rules must never be disabled.

### Key RLS rules

- **profiles**: only `auth.uid()` can access the profile row.
- **github_installations**: only the owning user can access installation records.
- **github_repo_access**: access only via the owning installation.
- **workspaces**: only the owning user can access workspace records.
- **workspace_logs**: only workspace owner can read logs.
- **audit_logs**: only `service_role` can write; clients cannot read.

## Backend Authorization Rules

Every request must validate:

- Active Supabase session (authentication)
- Correct `userId` matches session
- Ownership of the requested resource
- Installation is active and repo is still allowed

**Workspace ID alone is never sufficient for authorization.**

## Repository Access Guarantee

A user can only access a repository if:

- They have an active Supabase session.
- Their profile is linked to a GitHub ID.
- They own the GitHub App installation.
- The repo exists in `github_repo_access` and is active.

Any failure must result in a hard deny.

## Frontend → GitHub Restrictions

**The frontend must never call GitHub directly.**

- No GitHub tokens are exposed to the browser.
- All GitHub API calls are proxied through backend services (Netlify or Runtime Service).

## Token Handling Rules

- Tokens and secrets remain server-side only.
- No secrets in logs, client-side storage, or error messages.
- Session cookies are `httpOnly` and `secure`.

## Sandbox Isolation Rules

- Every workspace runs in its own sandbox.
- Sandboxes run as a low-privilege user.
- Sandboxes must have limited CPU, memory, PID count, and network access.
- Sandboxes should not access host secrets or other workspaces.
