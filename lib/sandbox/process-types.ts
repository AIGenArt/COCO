/**
 * Process Manager Types
 * 
 * Types for managing child processes (dev servers) per workspace
 */

export interface ProcessInfo {
  workspaceId: string;
  pid: number;
  port: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
  startedAt: Date;
  lastSeenAt: Date;
  logs: LogEntry[];
  workspacePath: string;
}

export interface LogEntry {
  type: 'stdout' | 'stderr' | 'status';
  message: string;
  timestamp: Date;
}

export interface ProcessManagerConfig {
  basePort: number;
  maxProcesses: number;
  logBufferSize: number;
  workspaceBaseDir: string;
}

export const DEFAULT_PROCESS_CONFIG: ProcessManagerConfig = {
  basePort: 3100,
  maxProcesses: 10,
  logBufferSize: 1000, // Max log entries to keep in memory
  workspaceBaseDir: '/tmp/coco-workspaces',
};
