# COCO Sandbox Architecture (Phase 2)

## Overview

This document defines the production-ready sandbox architecture for COCO workspaces. Each workspace runs in an isolated container with its own file system, dev server, and preview URL.

---

## Core Concepts

### Workspace Sandbox

An **isolated execution environment** for each workspace containing:
- Dedicated file system
- Running dev server (Next.js/Vite/etc)
- Unique preview URL
- Terminal access
- Resource limits

### Sandbox Lifecycle

```
CREATE → START → RUNNING → STOP → DESTROY
```

---

## Architecture Components

### 1. Sandbox Manager (Backend Service)

**Responsibilities:**
- Create/destroy sandbox containers
- Start/stop dev servers
- Manage file operations
- Handle terminal connections
- Monitor resource usage

**Technology:**
- Node.js/TypeScript service
- Docker SDK
- WebSocket server for terminals
- File system operations

**API Endpoints:**
```typescript
POST   /api/sandbox/create          // Create new sandbox
POST   /api/sandbox/{id}/start      // Start dev server
POST   /api/sandbox/{id}/stop       // Stop dev server
DELETE /api/sandbox/{id}            // Destroy sandbox
POST   /api/sandbox/{id}/exec       // Execute command
GET    /api/sandbox/{id}/status     // Get sandbox status
```

---

### 2. File Operations API

**Endpoints:**
```typescript
POST   /api/sandbox/{id}/files      // Write file
GET    /api/sandbox/{id}/files      // Read file
DELETE /api/sandbox/{id}/files      // Delete file
GET    /api/sandbox/{id}/tree       // Get file tree
```

**Request/Response:**
```typescript
// Write file
POST /api/sandbox/{id}/files
{
  "path": "app/page.tsx",
  "content": "export default function Page() { ... }"
}

// Response
{
  "success": true,
  "fileId": "abc123"
}
```

---

### 3. Preview URL System

**URL Pattern:**
```
https://ws-{workspace_id}.coco.dev
```

**Implementation:**
- Nginx reverse proxy
- Dynamic routing based on workspace ID
- SSL termination
- Rate limiting

**Configuration:**
```nginx
server {
  server_name ~^ws-(?<workspace_id>.+)\.coco\.dev$;
  
  location / {
    proxy_pass http://sandbox-$workspace_id:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

---

### 4. Terminal WebSocket

**Connection:**
```typescript
ws://api.coco.dev/sandbox/{id}/terminal
```

**Protocol:**
```typescript
// Client → Server
{
  "type": "input",
  "data": "npm install\n"
}

// Server → Client
{
  "type": "output",
  "data": "added 123 packages"
}
```

---

## Docker Container Spec

### Base Image

```dockerfile
FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache git

# Create workspace directory
WORKDIR /workspace

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Expose dev server port
EXPOSE 3000

# Start dev server
CMD ["npm", "run", "dev"]
```

### Resource Limits

```yaml
resources:
  limits:
    cpu: "1"
    memory: "2Gi"
  requests:
    cpu: "0.5"
    memory: "1Gi"
```

---

## Sandbox Manager Implementation

### TypeScript Interface

```typescript
interface SandboxManager {
  // Lifecycle
  createSandbox(workspaceId: string, config: SandboxConfig): Promise<Sandbox>;
  destroySandbox(workspaceId: string): Promise<void>;
  
  // Dev Server
  startDevServer(workspaceId: string): Promise<string>; // Returns preview URL
  stopDevServer(workspaceId: string): Promise<void>;
  getDevServerStatus(workspaceId: string): Promise<DevServerStatus>;
  
  // File Operations
  writeFile(workspaceId: string, path: string, content: string): Promise<void>;
  readFile(workspaceId: string, path: string): Promise<string>;
  deleteFile(workspaceId: string, path: string): Promise<void>;
  getFileTree(workspaceId: string): Promise<FileTree>;
  
  // Terminal
  executeCommand(workspaceId: string, command: string): Promise<CommandOutput>;
  createTerminalSession(workspaceId: string): Promise<TerminalSession>;
  
  // Monitoring
  getResourceUsage(workspaceId: string): Promise<ResourceUsage>;
  getLogs(workspaceId: string, lines: number): Promise<string[]>;
}

interface Sandbox {
  id: string;
  workspaceId: string;
  containerId: string;
  previewUrl: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  createdAt: Date;
  resources: ResourceUsage;
}

interface DevServerStatus {
  running: boolean;
  port: number;
  pid?: number;
  uptime?: number;
}

interface ResourceUsage {
  cpu: number;      // Percentage
  memory: number;   // MB
  disk: number;     // MB
}
```

---

## Frontend Integration

### Preview Service (Updated)

```typescript
class PreviewService {
  private workspaceId: string;
  private previewUrl: string | null = null;
  
  async initialize(workspaceId: string): Promise<void> {
    // Get preview URL from sandbox manager
    const response = await fetch(`/api/sandbox/${workspaceId}/preview-url`);
    const { url } = await response.json();
    this.previewUrl = url;
  }
  
  getPreviewUrl(): string {
    return this.previewUrl || 'http://localhost:3000'; // Fallback
  }
  
  async refresh(): Promise<void> {
    // Trigger dev server reload
    await fetch(`/api/sandbox/${this.workspaceId}/reload`, {
      method: 'POST'
    });
  }
}
```

### File Operations (Updated)

```typescript
class FileOperations {
  async writeFile(workspaceId: string, path: string, content: string): Promise<void> {
    await fetch(`/api/sandbox/${workspaceId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content })
    });
  }
  
  async readFile(workspaceId: string, path: string): Promise<string> {
    const response = await fetch(`/api/sandbox/${workspaceId}/files?path=${path}`);
    const { content } = await response.json();
    return content;
  }
}
```

---

## Security Considerations

### Container Isolation

- No network access between containers
- Read-only file system (except /workspace)
- No privileged mode
- Resource limits enforced

### API Authentication

```typescript
// All sandbox API calls require auth
headers: {
  'Authorization': `Bearer ${userToken}`,
  'X-Workspace-ID': workspaceId
}
```

### Rate Limiting

```typescript
// Per user limits
{
  maxWorkspaces: 5,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFilesPerWorkspace: 1000,
  maxCommandsPerMinute: 60
}
```

---

## Deployment Architecture

### Kubernetes Setup

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandbox-manager
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: sandbox-manager
        image: coco/sandbox-manager:latest
        env:
        - name: DOCKER_HOST
          value: unix:///var/run/docker.sock
        volumeMounts:
        - name: docker-sock
          mountPath: /var/run/docker.sock
      volumes:
      - name: docker-sock
        hostPath:
          path: /var/run/docker.sock
```

---

## Migration Path

### Phase 1 → Phase 2

**Current (Phase 1):**
```typescript
// Direct localhost access
<iframe src="http://localhost:3000" />
```

**Future (Phase 2):**
```typescript
// Sandbox preview URL
const previewUrl = await getSandboxPreviewUrl(workspaceId);
<iframe src={previewUrl} />
```

**Abstraction Layer:**
```typescript
// Works in both phases
const previewService = new PreviewService();
await previewService.initialize(workspaceId);
const url = previewService.getPreviewUrl();
```

---

## Implementation Timeline

### Week 1-2: Backend Foundation
- Sandbox manager service
- Docker integration
- Basic API endpoints

### Week 3-4: File Operations
- File CRUD operations
- File tree synchronization
- Real-time updates

### Week 5-6: Terminal & Preview
- WebSocket terminal
- Preview URL routing
- Dev server management

### Week 7-8: Production Hardening
- Security audit
- Performance optimization
- Monitoring & logging

---

## Success Metrics

### Performance
- Sandbox creation: < 5 seconds
- File operations: < 100ms
- Preview load time: < 2 seconds

### Reliability
- Uptime: 99.9%
- Container crash rate: < 0.1%
- Data loss: 0%

### Scalability
- Support 1000+ concurrent workspaces
- Auto-scaling based on load
- Resource utilization: < 70%

---

## Future Enhancements

### Phase 3+
- Collaborative editing (multiple users per workspace)
- Workspace templates
- Custom Docker images
- Persistent storage
- Workspace snapshots
- Time-travel debugging
- Performance profiling
- Cost optimization

---

## References

- Docker SDK: https://docs.docker.com/engine/api/sdk/
- Kubernetes: https://kubernetes.io/docs/
- WebSocket Protocol: https://datatracker.ietf.org/doc/html/rfc6455
- Next.js Dev Server: https://nextjs.org/docs/api-reference/cli#development
