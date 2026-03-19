export type WorkspaceSandboxId = string;

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type RunCommandOptions = {
  workspaceId: string;
  command: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
};

export type FileEntry = {
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
};

export type PreviewTarget = {
  url: string;
  port: number;
};

export interface SandboxProvider {
  createWorkspaceSandbox(workspaceId: string): Promise<WorkspaceSandboxId>;
  destroyWorkspaceSandbox(workspaceId: string): Promise<void>;
  startCommand(options: RunCommandOptions): Promise<CommandResult>;
  stopCommand(workspaceId: string, commandId: string): Promise<void>;
  restartCommand(workspaceId: string, commandId: string): Promise<CommandResult>;
  readFile(workspaceId: string, path: string): Promise<string>;
  writeFile(workspaceId: string, path: string, content: string): Promise<void>;
  listFiles(workspaceId: string, path: string): Promise<FileEntry[]>;
  getLogs(workspaceId: string, tail?: number): Promise<string>;
  getPreviewTarget(workspaceId: string): Promise<PreviewTarget>;
}
