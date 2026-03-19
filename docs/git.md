# Git Workflow & Rules

Git operations are performed through the runtime service using GitHub App installation tokens.

## Supported Git Actions

- Clone repository into sandbox
- Create / list branches
- Switch branches
- Commit changes
- Push changes
- Create pull requests

## Commit Format Rules

- Use clear, concise messages.
- Prefix commits with context when relevant (e.g., `feat:`, `fix:`, `docs:`).
- Include issue/PR references where applicable.

## Auto-Commit & Batch Logic

- Changes proposed by AI or automated actions should be staged and reviewed.
- Batch small related changes into a single commit when possible.
- Avoid committing large unrelated diffs.

## Secret Scanning

- Before committing, scan changed files for secrets.
- Reject commits containing high-risk patterns (API keys, tokens, private keys).

## AI Commit Handling

- AI can propose changes via structured actions.
- All AI-proposed changes must pass validation before being applied.
- AI must never provide raw commands to run in a workspace.

## Audit Logging

- All Git operations should be logged in `workspace_operations` and `workspace_logs`.
- Audit logs should record the user, operation type, and outcome.
