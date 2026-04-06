# COCO Sandbox Implementation Guide

**Part of:** COCO Sandbox Master Plan v2.0  
**Focus:** File-by-file implementation details

---

## Part 5: File-by-File Implementation Guide

### Runtime Service Structure

Create a separate service at project root:

```
runtime-service/
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── config.ts
│   ├── routes/
│   │   ├── sandboxes.ts
│   │   ├── files.ts
│   │   ├── commands.ts
│   │   ├── logs.ts
│   │   └── health.ts
│   ├── services/
│   │   ├── sandbox-manager.ts
│   │   ├── container-pool.ts
│   │   ├── dev-server-manager.ts
│   │   ├── file-service.ts
│   │   ├── command-service.ts
│   │   └── log-service.ts
│   ├── domain/
│   │   ├── sandbox-state.ts
│   │   └── sandbox-types.ts
│   ├── security/
│   │   ├── auth.ts
│   │   ├── path-validation.ts
│   │   ├── command-policy.ts
│   │   └── rate-limit.ts
│   ├── docker/
│   │   ├── docker-client.ts
│   │   └── workspace-image.ts
│   └── utils/
│       ├── logger.ts
│       ├── errors.ts
│       └── time.ts
```

### File Descriptions

#### `src/index.ts`
Entry point that starts the runtime service.

```typescript
import { createServer } from './server';
import { logger } from './utils/logger';
import { config } from './config';

async function main() {
  try {
    const server = await createServer();
    
    server.listen(config.port, () => {
      logger.info(`Runtime service started on port ${config.port}`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start runtime service', { error });
    process.exit(1);
  }
}

main();
```

#### `src/server.ts`
Express/Fastify app setup with middleware and routes.

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { sandboxesRouter } from './routes/sandboxes';
import { filesRouter } from './routes/files';
import { commandsRouter } from './routes/commands';
import { logsRouter } from './routes/logs';
import { healthRouter } from './routes/health';
import { authMiddleware } from './security/auth';
import { errorHandler } from './utils/errors';

export async function createServer() {
  const app = express();
  
  // Middleware
  app.use(helmet());
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }));
  app.use(express.json({ limit: '10mb' }));
  
  // Auth middleware (validates internal token)
  app.use('/runtime', authMiddleware);
  
  // Routes
  app.use('/runtime/sandboxes', sandboxesRouter);
  app.use('/runtime/sandboxes/:workspaceId/files', filesRouter);
  app.use('/runtime/sandboxes/:workspaceId/commands', commandsRouter);
  app.use('/runtime/sandboxes/:workspaceId/logs', logsRouter);
  app.use('/health', healthRouter);
  
  // Error handler
  app.use(errorHandler);
  
  return app;
}
```

#### `src/routes/sandboxes.ts`
Sandbox lifecycle routes.

```typescript
import { Router } from 'express';
import { SandboxManager } from '../services/sandbox-manager';
import { logger } from '../utils/logger';

const router = Router();
const sandboxManager = new SandboxManager();

// Create sandbox
router.post('/', async (req, res, next) => {
  try {
    const { workspaceId, template, userId } = req.body;
    
    logger.info('Creating sandbox', { workspaceId, template, userId });
    
    const sandbox = await sandboxManager.createSandbox({
      workspaceId,
      template,
      userId,
    });
    
    res.json(sandbox);
  } catch (error) {
    next(error);
  }
});

// Get status
router.get('/:workspaceId/status', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    
    const status = await sandboxManager.getStatus(workspaceId);
    
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// Stop sandbox
router.post('/:workspaceId/stop', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    
    await sandboxManager.stop(workspaceId);
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Restart sandbox
router.post('/:workspaceId/restart', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    
    await sandboxManager.restart(workspaceId);
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Destroy sandbox
router.delete('/:workspaceId', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    
    await sandboxManager.destroy(workspaceId);
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export { router as sandboxesRouter };
```

#### `src/services/sandbox-manager.ts`
Core sandbox orchestration logic.

```typescript
import { Docker } from 'dockerode';
import { SandboxState, SandboxRecord } from '../domain/sandbox-types';
import { StateMachine } from '../domain/sandbox-state';
import { DevServerManager } from './dev-server-manager';
import { logger } from '../utils/logger';

export class SandboxManager {
  private docker: Docker;
  private sandboxes: Map<string, SandboxRecord>;
  private stateMachines: Map<string, StateMachine>;
  
  constructor() {
    this.docker = new Docker();
    this.sandboxes = new Map();
    this.stateMachines = new Map();
  }
  
  async createSandbox(config: {
    workspaceId: string;
    template: string;
    userId: string;
  }): Promise<SandboxRecord> {
    const { workspaceId, template, userId } = config;
    
    // Create state machine
    const stateMachine = new StateMachine();
    this.stateMachines.set(workspaceId, stateMachine);
    
    // Transition to creating
    stateMachine.transition('creating');
    
    try {
      // Create workspace directory
      const workspacePath = `/var/coco/workspaces/${workspaceId}`;
      await fs.mkdir(workspacePath, { recursive: true });
      
      // Copy template
      await this.copyTemplate(template, workspacePath);
      
      // Create container
      const container = await this.docker.createContainer({
        Image: 'coco-workspace:latest',
        name: `coco-ws-${workspaceId}`,
        Volumes: {
          '/workspace': {}
        },
        HostConfig: {
          Binds: [`${workspacePath}:/workspace`],
          Memory: 2 * 1024 * 1024 * 1024, // 2GB
          NanoCpus: 1 * 1000000000, // 1 CPU
        },
        Env: [
          'NODE_ENV=development',
          `WORKSPACE_ID=${workspaceId}`,
        ],
      });
      
      // Transition to starting
      stateMachine.transition('starting');
      
      // Start container
      await container.start();
      
      // Start dev server
      const devServerManager = new DevServerManager(container);
      const devServerPort = await devServerManager.start();
      
      // Transition to running
      stateMachine.transition('running');
      
      // Create sandbox record
      const sandbox: SandboxRecord = {
        sandboxId: `sb_${Date.now()}`,
        workspaceId,
        userId,
        containerId: container.id,
        status: 'running',
        devServerPort,
        previewPath: `/api/preview/${workspaceId}/`,
        createdAt: new Date(),
        startedAt: new Date(),
      };
      
      this.sandboxes.set(workspaceId, sandbox);
      
      logger.info('Sandbox created successfully', { workspaceId });
      
      return sandbox;
    } catch (error) {
      stateMachine.transition('failed');
      logger.error('Failed to create sandbox', { workspaceId, error });
      throw error;
    }
  }
  
  async getStatus(workspaceId: string): Promise<SandboxRecord> {
    const sandbox = this.sandboxes.get(workspaceId);
    
    if (!sandbox) {
      throw new Error(`Sandbox not found: ${workspaceId}`);
    }
    
    return sandbox;
  }
  
  async stop(workspaceId: string): Promise<void> {
    const sandbox = this.sandboxes.get(workspaceId);
    const stateMachine = this.stateMachines.get(workspaceId);
    
    if (!sandbox || !stateMachine) {
      throw new Error(`Sandbox not found: ${workspaceId}`);
    }
    
    stateMachine.transition('stopping');
    
    const container = this.docker.getContainer(sandbox.containerId);
    await container.stop();
    
    stateMachine.transition('stopped');
    sandbox.status = 'stopped';
    
    logger.info('Sandbox stopped', { workspaceId });
  }
  
  async restart(workspaceId: string): Promise<void> {
    const sandbox = this.sandboxes.get(workspaceId);
    const stateMachine = this.stateMachines.get(workspaceId);
    
    if (!sandbox || !stateMachine) {
      throw new Error(`Sandbox not found: ${workspaceId}`);
    }
    
    stateMachine.transition('starting');
    
    const container = this.docker.getContainer(sandbox.containerId);
    await container.start();
    
    stateMachine.transition('running');
    sandbox.status = 'running';
    sandbox.startedAt = new Date();
    
    logger.info('Sandbox restarted', { workspaceId });
  }
  
  async destroy(workspaceId: string): Promise<void> {
    const sandbox = this.sandboxes.get(workspaceId);
    const stateMachine = this.stateMachines.get(workspaceId);
    
    if (!sandbox || !stateMachine) {
      throw new Error(`Sandbox not found: ${workspaceId}`);
    }
    
    stateMachine.transition('destroying');
    
    const container = this.docker.getContainer(sandbox.containerId);
    await container.remove({ force: true });
    
    stateMachine.transition('destroyed');
    
    this.sandboxes.delete(workspaceId);
    this.stateMachines.delete(workspaceId);
    
    logger.info('Sandbox destroyed', { workspaceId });
  }
  
  private async copyTemplate(template: string, targetPath: string): Promise<void> {
    const templatePath = `/var/coco/templates/${template}`;
    await exec(`cp -r ${templatePath}/* ${targetPath}/`);
  }
}
```

#### `src/domain/sandbox-state.ts`
State machine implementation.

```typescript
export type SandboxState = 
  | 'creating'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'destroying'
  | 'destroyed';

type Transition = {
  from: SandboxState;
  to: SandboxState;
};

const ALLOWED_TRANSITIONS: Transition[] = [
  { from: 'creating', to: 'starting' },
  { from: 'starting', to: 'running' },
  { from: 'starting', to: 'failed' },
  { from: 'running', to: 'stopping' },
  { from: 'running', to: 'failed' },
  { from: 'stopping', to: 'stopped' },
  { from: 'stopped', to: 'starting' },
  { from: 'stopped', to: 'destroying' },
  { from: 'failed', to: 'destroying' },
  { from: 'destroying', to: 'destroyed' },
];

export class StateMachine {
  private currentState: SandboxState = 'creating';
  
  transition(newState: SandboxState): void {
    const isAllowed = ALLOWED_TRANSITIONS.some(
      t => t.from === this.currentState && t.to === newState
    );
    
    if (!isAllowed) {
      throw new Error(
        `Invalid state transition: ${this.currentState} → ${newState}`
      );
    }
    
    this.currentState = newState;
  }
  
  getState(): SandboxState {
    return this.currentState;
  }
  
  canWriteFiles(): boolean {
    return this.currentState === 'running' || this.currentState === 'stopped';
  }
  
  canGetPreview(): boolean {
    return this.currentState === 'running';
  }
}
```

### Next.js App Changes

#### New Files to Create

```
app/api/sandbox/
├── create/
│   └── route.ts
└── [workspaceId]/
    ├── status/
    │   └── route.ts
    ├── files/
    │   ├── read/
    │   │   └── route.ts
    │   ├── write/
    │   │   └── route.ts
    │   ├── list/
    │   │   └── route.ts
    │   └── delete/
    │       └── route.ts
    ├── commands/
    │   └── route.ts
    ├── logs/
    │   └── route.ts
    ├── stop/
    │   └── route.ts
    ├── restart/
    │   └── route.ts
    └── destroy/
        └── route.ts

lib/sandbox/
├── runtime-client.ts
├── sandbox-types.ts
├── sandbox-service.ts
├── preview-service.ts
└── sync-service.ts
```

#### `lib/sandbox/runtime-client.ts`
HTTP client for runtime service.

```typescript
export class RuntimeClient {
  private baseUrl: string;
  private authToken: string;
  
  constructor() {
    this.baseUrl = process.env.RUNTIME_SERVICE_URL || 'http://localhost:3001';
    this.authToken = process.env.RUNTIME_SERVICE_TOKEN || '';
  }
  
  async createSandbox(config: {
    workspaceId: string;
    template: string;
    userId: string;
  }) {
    const response = await fetch(`${this.baseUrl}/runtime/sandboxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create sandbox: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getSandboxStatus(workspaceId: string) {
    const response = await fetch(
      `${this.baseUrl}/runtime/sandboxes/${workspaceId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get sandbox status: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async writeFile(workspaceId: string, path: string, content: string) {
    const response = await fetch(
      `${this.baseUrl}/runtime/sandboxes/${workspaceId}/files/write`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ path, content }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to write file: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async readFile(workspaceId: string, path: string) {
    const response = await fetch(
      `${this.baseUrl}/runtime/sandboxes/${workspaceId}/files/read?path=${encodeURIComponent(path)}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // ... other methods
}

export const runtimeClient = new RuntimeClient();
```

#### Update `lib/workspace/workspace-store.ts`

Add sandbox state:

```typescript
interface WorkspaceStore {
  // Existing state
  fileTree: FileTree;
  activeFileId: string | null;
  // ... other existing fields
  
  // NEW: Sandbox state
  sandboxId: string | null;
  sandboxStatus: SandboxState | null;
  previewUrl: string | null;
  isSandboxReady: boolean;
  lastSyncedAt: Date | null;
  
  // NEW: Sandbox actions
  initializeSandbox: () => Promise<void>;
  destroySandbox: () => Promise<void>;
  syncFromSandbox: () => Promise<void>;
}
```

### Implementation Order

#### Phase A: Runtime Service Foundation (Week 1)

**Tasks:**
1. Create `runtime-service/` directory structure
2. Implement `sandbox-manager.ts` skeleton
3. Implement `sandbox-state.ts` state machine
4. Create Docker workspace image
5. Test container create/start/stop

**Deliverables:**
- Runtime service starts
- Can create/destroy containers
- State machine works
- Basic logging

#### Phase B: File Operations (Week 1-2)

**Tasks:**
1. Implement `file-service.ts`
2. Add file routes (read/write/list/delete)
3. Add path validation
4. Test file operations

**Deliverables:**
- Can write files to sandbox
- Can read files from sandbox
- Path validation works
- Files persist across restarts

#### Phase C: Dev Server & Preview (Week 2)

**Tasks:**
1. Implement `dev-server-manager.ts`
2. Start `npm run dev` in container
3. Implement preview proxy route
4. Test hot reload

**Deliverables:**
- Dev server starts automatically
- Preview proxy works
- Hot reload functional
- Preview shows sandbox app

#### Phase D: Frontend Integration (Week 2-3)

**Tasks:**
1. Create `runtime-client.ts`
2. Update workspace store
3. Implement sync service
4. Connect preview iframe

**Deliverables:**
- Frontend can create sandbox
- File operations go through sandbox
- Preview shows sandbox content
- Store syncs with sandbox

#### Phase E: AI Integration (Week 3)

**Tasks:**
1. Update `action-executor.ts`
2. AI writes go to sandbox
3. Update build session
4. Test end-to-end flow

**Deliverables:**
- AI creates files in sandbox
- Preview updates after AI changes
- Editor shows synced state
- Output panel logs actions

#### Phase F: Polish & Testing (Week 3-4)

**Tasks:**
1. Add error handling
2. Implement rate limiting
3. Add monitoring
4. Write tests
5. Documentation

**Deliverables:**
- Robust error handling
- Rate limits enforced
- Metrics collected
- Tests passing
- Docs complete

### First 6 Files to Implement

**Start with these files in this order:**

1. **`runtime-service/src/domain/sandbox-state.ts`**
   - State machine logic
   - No dependencies
   - Foundation for everything

2. **`runtime-service/src/services/sandbox-manager.ts`**
   - Core orchestration
   - Uses state machine
   - Docker integration

3. **`runtime-service/src/server.ts`**
   - Express app setup
   - Routes registration
   - Middleware

4. **`runtime-service/src/routes/sandboxes.ts`**
   - Sandbox lifecycle endpoints
   - Uses sandbox manager

5. **`lib/sandbox/runtime-client.ts`**
   - HTTP client for Next.js
   - Calls runtime service
   - Used by all frontend code

6. **`app/api/preview/[workspaceId]/[...path]/route.ts`**
   - Preview proxy
   - Connects frontend to sandbox
   - Shows live preview

**Once these 6 files work, you have the core flow:**
```
Frontend → Runtime Client → Runtime Service → Docker → Preview
```

---

## Summary

This implementation guide provides:
- ✅ Complete file structure
- ✅ Code examples for key files
- ✅ Implementation order
- ✅ Phase-by-phase breakdown
- ✅ First 6 files to start with

**Next step:** Begin Phase A by creating the runtime service foundation.
