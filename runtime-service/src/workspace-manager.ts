import { DockerSandboxProvider } from "./sandbox/docker-sandbox-provider";
import { SandboxProvider } from "./sandbox/sandbox-provider";

export class WorkspaceManager {
  private readonly provider: SandboxProvider;

  constructor() {
    this.provider = new DockerSandboxProvider();
  }

  async createWorkspace(workspaceId: string) {
    return this.provider.createWorkspaceSandbox(workspaceId);
  }

  async destroyWorkspace(workspaceId: string) {
    return this.provider.destroyWorkspaceSandbox(workspaceId);
  }

  async runCommand(workspaceId: string, command: string[], env?: Record<string, string>) {
    return this.provider.startCommand({ workspaceId, command, env });
  }
}
