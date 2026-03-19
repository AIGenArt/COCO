# Runtime Service & Sandbox

The Runtime Service is the only component allowed to execute user code. It runs in a separate process and communicates with the Netlify API layer via a private authenticated REST interface.

## SandboxProvider Architecture

The runtime service exposes a `SandboxProvider` interface to abstract sandbox implementations.

Required methods:

- `createWorkspaceSandbox(workspaceId)`
- `destroyWorkspaceSandbox(workspaceId)`
- `startCommand(options)`
- `stopCommand(workspaceId, commandId)`
- `restartCommand(workspaceId, commandId)`
- `readFile(workspaceId, path)`
- `writeFile(workspaceId, path, content)`
- `listFiles(workspaceId, path)`
- `getLogs(workspaceId, tail)`
- `getPreviewTarget(workspaceId)`

## DockerSandboxProvider (Free-First)

The first implementation is Docker-based. Requirements:

- Non-root user inside container
- Read-only root filesystem
- Workspace mounted as a `tmpfs` or bind mount with limits
- Memory limit (512MB default)
- CPU limit (0.5 CPUs default)
- PID limit (e.g., 128)
- `no-new-privileges` and `cap-drop=ALL`
- Isolated networking

## Resource Limits

The sandbox must enforce:

- CPU & memory quota
- Disk usage limits
- Process count limits
- Strict filesystem access scoped to the workspace root

## Workspace Lifecycle

1. Create workspace record in Supabase
2. Create sandbox using `SandboxProvider`
3. Clone repo / create workspace files
4. Detect package manager
5. Run dependency install (`npm install`, `pnpm install`, etc.) inside sandbox
6. Start dev server in sandbox
7. Detect port and update workspace
8. Stream logs back to Supabase

## Recovery and Heartbeat

- Runtime service should detect and recover from orphaned processes.
- Workspace operations should be queued and serialized.
- Idle workspaces should stop after configured timeout.

## Log Streaming

- Runtime service streams logs to Supabase/Realtime for UI.
- Only selected logs are persisted to `workspace_logs`.
- Sensitive output (secrets, tokens) must be filtered.
