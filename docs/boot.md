# Boot Instructions (Copilot Agent)

When you start working in this repository, always do the following:

## Always follow

- `docs/master-prompt.md`
- `docs/security.md`
- `docs/rules.md`

## Before writing code

- Validate architecture alignment with the documented layers.
- Validate that security constraints are enforced.
- Ensure any code changes do not allow tokens to leak.
- Ensure RLS rules remain intact and correctly enforced.

## Never

- Bypass backend authorization.
- Expose secrets in commits, logs, or UI.
- Skip validation of ownership and installation access.
