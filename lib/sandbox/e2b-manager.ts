/**
 * E2B Sandbox Manager
 * 
 * Manages e2b.dev sandboxes for isolated Next.js workspaces.
 * Each workspace gets its own sandbox with Node.js runtime.
 * 
 * Integrates with workspace-bootstrap for deterministic initialization.
 */

import { Sandbox } from 'e2b';
import { 
  bootstrapWorkspace, 
  generateMinimalTemplate,
  type WorkspaceBootstrapPhase,
  type BootstrapResult 
} from './workspace-bootstrap';
import { waitForPreviewReady, type PreviewHealthResult } from './preview-health';
import { getPreviewUrl, normalizePreviewUrl } from './preview-url';

export interface E2BSandbox {
  id: string;
  url: string;
  sandbox: Sandbox;
}

export interface FileWrite {
  path: string;
  content: string;
}

export type DevServerStatus = 
  | 'bootstrapping'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'failed';

export interface DevServerProgress {
  status: DevServerStatus;
  message: string;
  phase?: WorkspaceBootstrapPhase;
  error?: string;
}

/**
 * E2B Manager - Handles sandbox lifecycle
 */
export class E2BManager {
  private static sandboxes = new Map<string, Sandbox>();

  /**
   * Get or reconnect to an existing sandbox by ID
   * This is the key method that makes the manager stateless-friendly
   */
  static async getOrReconnectSandbox(sandboxId: string): Promise<Sandbox> {
    // Check cache first
    const cached = this.sandboxes.get(sandboxId);
    if (cached) {
      console.log(`[E2B] Using cached sandbox: ${sandboxId}`);
      return cached;
    }

    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
      throw new Error('E2B_API_KEY not found in environment variables');
    }

    console.log(`[E2B] Reconnecting to sandbox: ${sandboxId}...`);

    try {
      // Reconnect to existing sandbox
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey,
        timeoutMs: 30000, // 30 second timeout for reconnect
      });

      // Cache it
      this.sandboxes.set(sandboxId, sandbox);
      console.log(`[E2B] ✓ Successfully reconnected to sandbox: ${sandboxId}`);

      return sandbox;
    } catch (error) {
      console.error(`[E2B] ✗ Failed to reconnect to sandbox ${sandboxId}:`, error);
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }
  }

  /**
   * Create a new e2b sandbox
   */
  static async createSandbox(workspaceId: string): Promise<E2BSandbox> {
    const apiKey = process.env.E2B_API_KEY;
    
    if (!apiKey) {
      const error = 'E2B_API_KEY not found in environment variables';
      console.error(`[E2B] ✗ ${error}`);
      throw new Error(error);
    }

    console.log(`[E2B] Creating sandbox for workspace ${workspaceId}...`);
    console.log(`[E2B] Using template: code-interpreter-v1 (2GB RAM)`);

    try {
      // Create new sandbox with code-interpreter template (2GB RAM vs 512MB on base)
      const sandbox = await Sandbox.create('code-interpreter-v1', {
        apiKey,
        metadata: {
          workspaceId,
          createdAt: new Date().toISOString(),
        },
        timeoutMs: 60000, // 60 second timeout for sandbox creation
      });

      // Store reference
      this.sandboxes.set(workspaceId, sandbox);

      console.log(`[E2B] ✓ Sandbox created: ${sandbox.sandboxId}`);

      // Get sandbox URL (E2B handles port forwarding automatically)
      const url = `https://${sandbox.sandboxId}.e2b.dev`;
      console.log(`[E2B] Sandbox URL: ${url}`);

      return {
        id: sandbox.sandboxId,
        url,
        sandbox,
      };
    } catch (error) {
      console.error('[E2B] ✗ Failed to create sandbox');
      console.error('[E2B] Error details:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('E2B sandbox creation timed out. Please try again.');
        } else if (error.message.includes('API key')) {
          throw new Error('Invalid E2B API key. Please check your configuration.');
        } else if (error.message.includes('template')) {
          throw new Error('E2B template "code-interpreter-v1" not found. Please check E2B dashboard.');
        } else {
          throw new Error(`E2B error: ${error.message}`);
        }
      }
      
      throw new Error('Failed to create E2B sandbox. Please check server logs for details.');
    }
  }

  /**
   * Write files to sandbox filesystem
   */
  static async writeFiles(
    sandboxId: string,
    files: FileWrite[]
  ): Promise<void> {
    console.log(`[E2B] Writing ${files.length} files to sandbox ${sandboxId}...`);

    try {
      // Get or reconnect to sandbox
      const sandbox = await this.getOrReconnectSandbox(sandboxId);

      for (const file of files) {
        // Create directory if needed
        const dir = file.path.substring(0, file.path.lastIndexOf('/'));
        if (dir) {
          await sandbox.files.makeDir(dir);
        }
        
        // Write file
        await sandbox.files.write(file.path, file.content);
      }

      console.log(`[E2B] ✓ Successfully wrote ${files.length} files`);
    } catch (error) {
      console.error('[E2B] ✗ Failed to write files:', error);
      throw new Error(`Failed to write files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute command in sandbox
   */
  static async executeCommand(
    workspaceId: string,
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const sandbox = this.sandboxes.get(workspaceId);
    
    if (!sandbox) {
      throw new Error(`No sandbox found for workspace ${workspaceId}`);
    }

    console.log(`[E2B] Executing command: ${command}`);

    try {
      const result = await sandbox.commands.run(command);

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      console.error('[E2B] Command execution failed:', error);
      throw new Error(`Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start Next.js dev server in sandbox with progress tracking
   * Includes workspace bootstrap with validation
   */
  static async startDevServer(
    sandboxId: string,
    port: number = 3000,
    onProgress?: (progress: DevServerProgress) => void
  ): Promise<void> {
    console.log(`[E2B] ========================================`);
    console.log(`[E2B] Starting Next.js dev server on port ${port}...`);
    console.log(`[E2B] Sandbox ID: ${sandboxId}`);
    console.log(`[E2B] ========================================`);

    try {
      // Get or reconnect to sandbox
      const sandbox = await this.getOrReconnectSandbox(sandboxId);

      // STEP 1: Bootstrap workspace
      console.log('[E2B] Step 1/4: Bootstrapping workspace...');
      onProgress?.({
        status: 'bootstrapping',
        message: 'Bootstrapping workspace...',
        phase: 'prepare_source',
      });

      const template = generateMinimalTemplate();
      
      const bootstrapResult = await bootstrapWorkspace(
        template,
        async (path, content) => {
          // Create directory if needed
          const dir = path.substring(0, path.lastIndexOf('/'));
          if (dir) {
            await sandbox.files.makeDir(dir);
          }
          await sandbox.files.write(path, content);
        },
        async (path) => {
          try {
            await sandbox.files.read(path);
            return true;
          } catch {
            return false;
          }
        },
        (phase) => {
          onProgress?.({
            status: 'bootstrapping',
            message: `Bootstrap phase: ${phase}`,
            phase,
          });
        }
      );

      // FAIL FAST if bootstrap validation failed
      if (!bootstrapResult.success) {
        const error = `Bootstrap failed at phase ${bootstrapResult.phase}: ${bootstrapResult.error}`;
        console.error(`[E2B] ✗ ${error}`);
        
        if (bootstrapResult.missingFiles && bootstrapResult.missingFiles.length > 0) {
          console.error('[E2B] Missing files:', bootstrapResult.missingFiles);
        }
        
        onProgress?.({
          status: 'failed',
          message: 'Bootstrap validation failed',
          error: bootstrapResult.error,
        });
        
        throw new Error(error);
      }

      console.log('[E2B] ✓ Step 1/4: Workspace bootstrapped and validated');
      console.log('[E2B] Validated files:', bootstrapResult.validatedFiles);

      // VERIFICATION: Check filesystem state after bootstrap
      console.log('[E2B] ========================================');
      console.log('[E2B] VERIFICATION: Checking filesystem state...');
      console.log('[E2B] ========================================');
      
      try {
        // Check working directory
        const pwdResult = await sandbox.commands.run('pwd');
        console.log('[E2B] Working directory:', pwdResult.stdout.trim());
        
        // List root directory
        const lsRootResult = await sandbox.commands.run('ls -la');
        console.log('[E2B] Root directory contents:');
        console.log(lsRootResult.stdout);
        
        // List app directory
        const lsAppResult = await sandbox.commands.run('ls -la app/');
        console.log('[E2B] app/ directory contents:');
        console.log(lsAppResult.stdout);
        
        // Verify critical files exist
        const checkLayout = await sandbox.commands.run('test -f app/layout.tsx && echo "EXISTS" || echo "MISSING"');
        console.log('[E2B] app/layout.tsx:', checkLayout.stdout.trim());
        
        const checkPage = await sandbox.commands.run('test -f app/page.tsx && echo "EXISTS" || echo "MISSING"');
        console.log('[E2B] app/page.tsx:', checkPage.stdout.trim());
        
        const checkPackageJson = await sandbox.commands.run('test -f package.json && echo "EXISTS" || echo "MISSING"');
        console.log('[E2B] package.json:', checkPackageJson.stdout.trim());
        
        // Show first few lines of app/layout.tsx
        const layoutContent = await sandbox.commands.run('head -20 app/layout.tsx');
        console.log('[E2B] app/layout.tsx content (first 20 lines):');
        console.log(layoutContent.stdout);
        
        console.log('[E2B] ========================================');
        console.log('[E2B] VERIFICATION COMPLETE');
        console.log('[E2B] ========================================');
      } catch (verifyError) {
        console.error('[E2B] ✗ Verification failed:', verifyError);
      }

      // STEP 2: Install dependencies
      // Check if package-lock.json exists to decide between npm ci and npm install
      let hasPackageLock = false;
      try {
        await sandbox.files.read('package-lock.json');
        hasPackageLock = true;
      } catch {
        // File doesn't exist, use npm install
      }

      const installCmd = hasPackageLock 
        ? 'npm ci --prefer-offline --no-audit'
        : 'npm install --prefer-offline --no-audit';
      
      console.log(`[E2B] Step 2/4: Installing dependencies...`);
      console.log(`[E2B] Command: ${installCmd}`);
      console.log(`[E2B] Timestamp: ${new Date().toISOString()}`);
      onProgress?.({
        status: 'installing',
        message: 'Installing dependencies...'
      });

      const installResult = await sandbox.commands.run(installCmd, {
        timeoutMs: 0, // No timeout - let npm install complete
      });

      console.log('[E2B] ✓ Step 2/4: Dependencies installed successfully');
      console.log('[E2B] npm install stdout:', installResult.stdout.slice(-500)); // Last 500 chars
      if (installResult.stderr) {
        console.log('[E2B] npm install stderr:', installResult.stderr.slice(-500));
      }
      console.log(`[E2B] Install completed at: ${new Date().toISOString()}`);

      // STEP 3: Start dev server
      console.log('[E2B] Step 3/4: Starting dev server...');
      console.log(`[E2B] Timestamp: ${new Date().toISOString()}`);
      onProgress?.({
        status: 'starting',
        message: 'Starting preview server...'
      });

      // Verify working directory before starting dev server
      const pwdBeforeStart = await sandbox.commands.run('pwd');
      console.log('[E2B] Working directory before dev server start:', pwdBeforeStart.stdout.trim());

      // Start dev server in background using nohup to prevent termination
      // The & at the end makes it run in background, nohup prevents hangup signal
      const devServerCmd = `nohup npm run dev -- --port ${port} --hostname 0.0.0.0 > /tmp/dev-server.log 2>&1 &`;
      console.log('[E2B] Dev server command:', devServerCmd);
      
      await sandbox.commands.run(devServerCmd, { timeoutMs: 5000 });
      
      console.log('[E2B] ✓ Dev server started in background');
      console.log(`[E2B] Dev server start timestamp: ${new Date().toISOString()}`);

      // Give the dev server time to start
      console.log('[E2B] Waiting 10 seconds for dev server to initialize...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check dev server process
      const psResult = await sandbox.commands.run('ps aux | grep "next dev" | grep -v grep || echo "No process found"');
      console.log('[E2B] Dev server process check:');
      console.log(psResult.stdout);
      
      // Read initial dev server logs
      const logResult = await sandbox.commands.run('cat /tmp/dev-server.log 2>/dev/null || echo "Log file not found"');
      console.log('[E2B] ========================================');
      console.log('[E2B] Dev server logs (/tmp/dev-server.log):');
      console.log(logResult.stdout);
      console.log('[E2B] ========================================');
      
      console.log('[E2B] ✓ Step 3/4: Dev server command started');

      // STEP 4: Wait for health check using preview-health module
      console.log('[E2B] Step 4/4: Waiting for health check...');
      const rawPreviewUrl = `https://${sandbox.getHost(port)}`;
      const previewUrl = normalizePreviewUrl(rawPreviewUrl);
      console.log(`[E2B] Raw preview URL: ${rawPreviewUrl}`);
      console.log(`[E2B] Normalized preview URL: ${previewUrl}`);
      
      // Test chunk endpoint directly before health check
      console.log('[E2B] ========================================');
      console.log('[E2B] Testing chunk endpoint directly...');
      try {
        const chunkTestUrl = `${previewUrl}/_next/static/chunks/app/layout.js`;
        console.log('[E2B] Chunk URL:', chunkTestUrl);
        
        const chunkResponse = await fetch(chunkTestUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        console.log('[E2B] Chunk endpoint status:', chunkResponse.status);
        console.log('[E2B] Chunk endpoint headers:', Object.fromEntries(chunkResponse.headers.entries()));
      } catch (chunkError) {
        console.error('[E2B] ✗ Chunk endpoint test failed:', chunkError);
      }
      console.log('[E2B] ========================================');
      
      const healthResult = await waitForPreviewReady(previewUrl, {
        maxAttempts: 120,
        intervalMs: 2000,
        timeoutMs: 5000,
        onProgress: (attempt, result) => {
          console.log(`[E2B] Health check attempt ${attempt}: ${result.status}`);
          
          // Log dev server output every 10 attempts
          if (attempt % 10 === 0) {
            sandbox.commands.run('tail -50 /tmp/dev-server.log 2>/dev/null || echo "No logs"')
              .then(logResult => {
                console.log(`[E2B] Dev server logs (attempt ${attempt}):`);
                console.log(logResult.stdout);
              })
              .catch(() => {});
          }
        },
      });
      
      if (healthResult.status !== 'ready') {
        console.error('[E2B] ✗ Step 4/4: Health check failed');
        console.error('[E2B] Health result:', healthResult);
        throw new Error(`Preview not ready: ${healthResult.error || 'Unknown error'}`);
      }
      
      console.log(`[E2B] ✓ Step 4/4: Health check passed - preview is ready!`);
      console.log(`[E2B] Response time: ${healthResult.responseTime}ms`);
      console.log(`[E2B] ========================================`);
      onProgress?.({
        status: 'ready',
        message: 'Preview ready'
      });
    } catch (error) {
      console.error('[E2B] Failed to start dev server:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      onProgress?.({
        status: 'failed',
        message: 'Failed to start preview',
        error: errorMessage
      });
      
      throw new Error(`Failed to start dev server: ${errorMessage}`);
    }
  }

  /**
   * Check if dev server is responding
   */
  static async healthCheck(
    workspaceId: string,
    port: number = 3000
  ): Promise<boolean> {
    const sandbox = this.sandboxes.get(workspaceId);
    if (!sandbox) {
      return false;
    }

    try {
      const url = `https://${sandbox.getHost(port)}`;
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get sandbox by workspace ID
   */
  static getSandbox(workspaceId: string): Sandbox | undefined {
    return this.sandboxes.get(workspaceId);
  }

  /**
   * Destroy sandbox and cleanup
   */
  static async destroySandbox(workspaceId: string): Promise<void> {
    const sandbox = this.sandboxes.get(workspaceId);
    
    if (!sandbox) {
      console.warn(`[E2B] No sandbox found for workspace ${workspaceId}`);
      return;
    }

    console.log(`[E2B] Destroying sandbox for workspace ${workspaceId}...`);

    try {
      await sandbox.kill();
      this.sandboxes.delete(workspaceId);
      console.log(`[E2B] Sandbox destroyed successfully`);
    } catch (error) {
      console.error('[E2B] Failed to destroy sandbox:', error);
      throw new Error(`Failed to destroy sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if sandbox exists
   */
  static hasSandbox(workspaceId: string): boolean {
    return this.sandboxes.has(workspaceId);
  }

  /**
   * Get all active sandboxes
   */
  static getActiveSandboxes(): string[] {
    return Array.from(this.sandboxes.keys());
  }
}
