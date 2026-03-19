import { execFile } from "node:child_process";
import { mkdirSync, rmSync, promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  SandboxProvider,
  WorkspaceSandboxId,
  RunCommandOptions,
  CommandResult,
  FileEntry,
  PreviewTarget
} from "./sandbox-provider";

const execFileAsync = promisify(execFile);

const WORKSPACES_ROOT = process.env.RUNTIME_WORKSPACES_ROOT ?? "/tmp/coco/workspaces";

function sanitizeWorkspaceId(workspaceId: string) {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function containerName(workspaceId: string) {
  return `coco_ws_${sanitizeWorkspaceId(workspaceId)}`;
}

function workspacePath(workspaceId: string) {
  return join(WORKSPACES_ROOT, sanitizeWorkspaceId(workspaceId));
}

export class DockerSandboxProvider implements SandboxProvider {
  async createWorkspaceSandbox(workspaceId: string): Promise<WorkspaceSandboxId> {
    const workspaceDir = workspacePath(workspaceId);
    mkdirSync(workspaceDir, { recursive: true });

    const name = containerName(workspaceId);

    // Create a minimal container that stays running and can be exec'd into.
    // It uses a low-privilege user and limits resources.
    await execFileAsync("docker", [
      "run",
      "-d",
      "--name",
      name,
      "--rm",
      "--read-only",
      "--tmpfs",
      "/tmp:rw,exec,nosuid,nodev",
      "--memory",
      "512m",
      "--pids-limit",
      "128",
      "--cpus",
      "0.5",
      "--network",
      "none",
      "--user",
      "node",
      "--security-opt",
      "no-new-privileges",
      "--cap-drop",
      "ALL",
      "--volume",
      `${workspaceDir}:/workspace:rw`,
      "--workdir",
      "/workspace",
      "node:20-bullseye-slim",
      "tail",
      "-f",
      "/dev/null"
    ]);

    return name;
  }

  async destroyWorkspaceSandbox(workspaceId: string): Promise<void> {
    const name = containerName(workspaceId);
    try {
      await execFileAsync("docker", ["rm", "-f", name]);
    } catch {
      // ignore
    }

    const workspaceDir = workspacePath(workspaceId);
    try {
      rmSync(workspaceDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  async startCommand(options: RunCommandOptions): Promise<CommandResult> {
    const { workspaceId, command, env } = options;
    const name = containerName(workspaceId);

    const dockerArgs = ["exec", "--workdir", "/workspace"];

    if (env) {
      for (const [key, value] of Object.entries(env)) {
        dockerArgs.push("-e", `${key}=${value}`);
      }
    }

    dockerArgs.push(name);
    dockerArgs.push(...command);

    try {
      const result = await execFileAsync("docker", dockerArgs, {
        env: {
          ...process.env
        }
      });

      return {
        exitCode: 0,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString()
      };
    } catch (err: any) {
      return {
        exitCode: typeof err.code === "number" ? err.code : 1,
        stdout: err.stdout?.toString() ?? "",
        stderr: err.stderr?.toString() ?? err.message ?? ""
      };
    }
  }

  async stopCommand(_workspaceId: string, _commandId: string): Promise<void> {
    // Command stopping not implemented in this MVP.
  }

  async restartCommand(_workspaceId: string, _commandId: string): Promise<CommandResult> {
    throw new Error("Not implemented");
  }

  private sanitizePath(workspaceId: string, relativePath: string) {
    const root = workspacePath(workspaceId);
    const resolved = resolve(root, relativePath);
    if (!resolved.startsWith(root)) {
      throw new Error("Invalid path");
    }
    return resolved;
  }

  async readFile(workspaceId: string, path: string): Promise<string> {
    const resolved = this.sanitizePath(workspaceId, path);
    return fs.readFile(resolved, "utf-8");
  }

  async writeFile(workspaceId: string, path: string, content: string): Promise<void> {
    const resolved = this.sanitizePath(workspaceId, path);
    const dir = resolve(resolved, "..");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(resolved, content, "utf-8");
  }

  async listFiles(workspaceId: string, path: string): Promise<FileEntry[]> {
    const resolved = this.sanitizePath(workspaceId, path);
    const entries = await fs.readdir(resolved, { withFileTypes: true });

    return await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(resolved, entry.name);
        const stat = await fs.stat(fullPath);
        return {
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString()
        };
      })
    );
  }

  async getLogs(workspaceId: string, tail = 100): Promise<string> {
    const name = containerName(workspaceId);
    const result = await execFileAsync("docker", ["logs", "--tail", String(tail), name]);
    return result.stdout.toString();
  }

  async getPreviewTarget(workspaceId: string): Promise<PreviewTarget> {
    // For MVP, the preview target is not yet implemented.
    return { url: "", port: 0 };
  }
}
