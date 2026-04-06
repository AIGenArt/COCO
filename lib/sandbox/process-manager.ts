/**
 * Process Manager
 * 
 * Manages child processes (dev servers) for workspaces
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { ProcessInfo, LogEntry, DEFAULT_PROCESS_CONFIG } from './process-types';
import { portManager } from './port-manager';
import {
  generatePackageJson,
  generateNextConfig,
  generateTailwindConfig,
  generateTsConfig,
  generatePostCssConfig,
  generateLibUtils,
  generateHooks,
} from './template-generator';

class ProcessManager {
  private processes: Map<string, ProcessInfo> = new Map();
  private childProcesses: Map<string, ChildProcess> = new Map();
  private config = DEFAULT_PROCESS_CONFIG;

  /**
   * Create a new workspace from template
   */
  async createWorkspace(workspaceId: string): Promise<{ workspacePath: string; port: number }> {
    const port = portManager.allocatePort(workspaceId);
    const workspacePath = path.join(this.config.workspaceBaseDir, workspaceId);

    try {
      // 1. Create workspace directory
      await fs.mkdir(workspacePath, { recursive: true });

      // 2. Extract template
      const templatePath = path.join(process.cwd(), 'BLANK.tar.gz');
      await this.extractTemplate(templatePath, workspacePath);

      // 3. Generate config files
      await generatePackageJson(workspacePath, workspaceId, port);
      await generateNextConfig(workspacePath);
      await generateTailwindConfig(workspacePath);
      await generateTsConfig(workspacePath);
      await generatePostCssConfig(workspacePath);
      await generateLibUtils(workspacePath);
      await generateHooks(workspacePath);

      // 4. Install dependencies
      await this.installDependencies(workspacePath);

      return { workspacePath, port };
    } catch (error) {
      // Cleanup on error
      portManager.releasePort(workspaceId);
      throw error;
    }
  }

  /**
   * Extract template to workspace directory
   */
  private async extractTemplate(templatePath: string, workspacePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', [
        '-xzf',
        templatePath,
        '-C',
        workspacePath,
        '--strip-components=1'
      ]);

      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Template extraction failed with code ${code}`));
        }
      });

      tar.on('error', reject);
    });
  }

  /**
   * Install npm dependencies
   */
  private async installDependencies(workspacePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install'], {
        cwd: workspacePath,
        stdio: 'pipe',
      });

      let output = '';

      npm.stdout?.on('data', (data) => {
        output += data.toString();
      });

      npm.stderr?.on('data', (data) => {
        output += data.toString();
      });

      npm.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install failed: ${output}`));
        }
      });

      npm.on('error', reject);
    });
  }

  /**
   * Start dev server for workspace
   */
  async startDevServer(workspaceId: string, workspacePath: string): Promise<ProcessInfo> {
    // Check if already running
    const existing = this.processes.get(workspaceId);
    if (existing && existing.status === 'running') {
      return existing;
    }

    const port = portManager.getPort(workspaceId);
    if (!port) {
      throw new Error(`No port allocated for workspace ${workspaceId}`);
    }

    // Create process info
    const processInfo: ProcessInfo = {
      workspaceId,
      pid: 0,
      port,
      status: 'starting',
      startedAt: new Date(),
      lastSeenAt: new Date(),
      logs: [],
      workspacePath,
    };

    this.processes.set(workspaceId, processInfo);

    // Spawn dev server
    const child = spawn('npm', ['run', 'dev'], {
      cwd: workspacePath,
      stdio: 'pipe',
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    });

    processInfo.pid = child.pid || 0;
    this.childProcesses.set(workspaceId, child);

    // Handle stdout
    child.stdout?.on('data', (data) => {
      const message = data.toString();
      this.addLog(workspaceId, 'stdout', message);

      // Check if server is ready
      if (message.includes('Ready in') || message.includes('started server on')) {
        processInfo.status = 'running';
        processInfo.lastSeenAt = new Date();
      }
    });

    // Handle stderr
    child.stderr?.on('data', (data) => {
      const message = data.toString();
      this.addLog(workspaceId, 'stderr', message);
    });

    // Handle process exit
    child.on('close', (code) => {
      if (code === 0) {
        processInfo.status = 'stopped';
      } else {
        processInfo.status = 'failed';
      }
      this.addLog(workspaceId, 'status', `Process exited with code ${code}`);
      this.childProcesses.delete(workspaceId);
    });

    child.on('error', (error) => {
      processInfo.status = 'failed';
      this.addLog(workspaceId, 'stderr', `Process error: ${error.message}`);
    });

    return processInfo;
  }

  /**
   * Stop dev server
   */
  async stopDevServer(workspaceId: string): Promise<void> {
    const processInfo = this.processes.get(workspaceId);
    const child = this.childProcesses.get(workspaceId);

    if (!processInfo || !child) {
      return;
    }

    processInfo.status = 'stopping';
    this.addLog(workspaceId, 'status', 'Stopping dev server...');

    return new Promise((resolve) => {
      child.on('close', () => {
        processInfo.status = 'stopped';
        this.addLog(workspaceId, 'status', 'Dev server stopped');
        this.childProcesses.delete(workspaceId);
        resolve();
      });

      // Try graceful shutdown first
      child.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.childProcesses.has(workspaceId)) {
          child.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Get process info
   */
  getProcessInfo(workspaceId: string): ProcessInfo | null {
    return this.processes.get(workspaceId) || null;
  }

  /**
   * Get logs for workspace
   */
  getLogs(workspaceId: string, limit?: number): LogEntry[] {
    const processInfo = this.processes.get(workspaceId);
    if (!processInfo) {
      return [];
    }

    const logs = processInfo.logs;
    if (limit) {
      return logs.slice(-limit);
    }
    return logs;
  }

  /**
   * Add log entry
   */
  private addLog(workspaceId: string, type: LogEntry['type'], message: string): void {
    const processInfo = this.processes.get(workspaceId);
    if (!processInfo) {
      return;
    }

    const logEntry: LogEntry = {
      type,
      message,
      timestamp: new Date(),
    };

    processInfo.logs.push(logEntry);

    // Trim logs if exceeds buffer size
    if (processInfo.logs.length > this.config.logBufferSize) {
      processInfo.logs = processInfo.logs.slice(-this.config.logBufferSize);
    }

    processInfo.lastSeenAt = new Date();
  }

  /**
   * Check if workspace exists
   */
  async workspaceExists(workspaceId: string): Promise<boolean> {
    const workspacePath = path.join(this.config.workspaceBaseDir, workspaceId);
    try {
      await fs.access(workspacePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    // Stop dev server if running
    await this.stopDevServer(workspaceId);

    // Delete workspace directory
    const workspacePath = path.join(this.config.workspaceBaseDir, workspaceId);
    await fs.rm(workspacePath, { recursive: true, force: true });

    // Release port
    portManager.releasePort(workspaceId);

    // Remove from processes
    this.processes.delete(workspaceId);
  }

  /**
   * Get all running processes
   */
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Cleanup stale processes
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [workspaceId, processInfo] of Array.from(this.processes.entries())) {
      const timeSinceLastSeen = now - processInfo.lastSeenAt.getTime();
      
      if (timeSinceLastSeen > staleThreshold && processInfo.status === 'running') {
        console.log(`Cleaning up stale process for workspace ${workspaceId}`);
        await this.stopDevServer(workspaceId);
      }
    }
  }
}

// Singleton instance
export const processManager = new ProcessManager();
