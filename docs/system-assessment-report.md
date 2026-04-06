# COCO System Assessment Report

**Date:** 2026-03-21  
**Purpose:** Pre-implementation assessment for sandbox architecture  
**Status:** Complete

---

## 🔍 System Assessment Results

### 1. Docker Status
**Status:** ❌ **NOT INSTALLED**

```bash
$ docker --version
bash: docker: command not found
```

**Impact:** Critical - Docker is required for sandbox architecture  
**Action Required:** Install Docker or use alternative approach

### 2. Port Availability
**Status:** ✅ **AVAILABLE**

```bash
Port 3001 is available
```

**Impact:** None - Port is ready for runtime service  
**Action Required:** None

### 3. File System Permissions
**Status:** ❌ **DIRECTORY DOES NOT EXIST**

```bash
Directory /var/coco does not exist
```

**Impact:** Medium - Need to create workspace directory  
**Action Required:** Create directory structure or use alternative location

### 4. Supabase Configuration
**Status:** ⚠️ **PARTIALLY CONFIGURED**

**What Exists:**
- ✅ Project URL: `https://vznkmrsxwnudpykbanxu.supabase.co`
- ✅ Publishable Key: Available
- ✅ AI Governance migration: `0003_ai_governance.sql`

**What's Missing:**
- ❌ Supabase URL not in `.env.local`
- ❌ Supabase Anon Key not in `.env.local`
- ❌ Workspace tables (from master plan)
- ❌ Sandbox tables (from master plan)

### 5. Dependencies
**Status:** ⚠️ **MISSING SANDBOX DEPENDENCIES**

**Current Dependencies:**
- ✅ Next.js 14.2.35
- ✅ React 18
- ✅ TypeScript 5
- ✅ Tailwind CSS
- ✅ shadcn/ui components
- ✅ Monaco Editor
- ✅ XTerm.js
- ✅ Zustand

**Missing for Sandbox:**
- ❌ `dockerode` (Docker SDK)
- ❌ `express` or `fastify` (Runtime service)
- ❌ `@supabase/supabase-js` (Supabase client)
- ❌ `ws` (WebSocket support)

---

## 🚨 Critical Issue: No Docker

### Problem
The sandbox architecture in the master plan requires Docker for:
- Container isolation
- Workspace sandboxing
- Dev server execution
- File system persistence

### Options

#### Option A: Install Docker (Recommended for Production)
**Pros:**
- ✅ Full isolation
- ✅ Production-ready
- ✅ Follows master plan exactly
- ✅ Best security

**Cons:**
- ❌ Requires system access
- ❌ More complex setup
- ❌ May not work in all environments

**Action:**
```bash
# Install Docker (requires sudo)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

#### Option B: Use WebContainers (Alternative for MVP)
**Pros:**
- ✅ No Docker required
- ✅ Works in browser
- ✅ Faster for MVP
- ✅ Similar to StackBlitz

**Cons:**
- ❌ Less isolation
- ❌ Browser-based limitations
- ❌ Different from master plan

**Technology:**
- Use `@webcontainer/api`
- Run Node.js in browser
- File system in memory/IndexedDB

#### Option C: Hybrid Approach (Recommended for MVP)
**Pros:**
- ✅ Works without Docker
- ✅ Can upgrade to Docker later
- ✅ Faster to implement
- ✅ Good for development

**Cons:**
- ❌ Less secure initially
- ❌ Need migration path

**Approach:**
1. Start with in-process sandboxing
2. Use separate Node.js process per workspace
3. File system in project directory
4. Migrate to Docker when ready

---

## 📋 Recommended Implementation Plan

### Phase 0: Environment Setup (NEW - Week 0)

**Goal:** Get environment ready for sandbox implementation

**Tasks:**

1. **Update `.env.local` with Supabase**
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://vznkmrsxwnudpykbanxu.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

2. **Create Supabase Migrations**
   - `0004_workspaces.sql` - Workspace tables
   - `0005_sandbox_instances.sql` - Sandbox metadata
   - `0006_sandbox_events.sql` - Sandbox events

3. **Install Dependencies**
   ```bash
   npm install @supabase/supabase-js
   npm install express cors helmet
   npm install ws
   # Skip dockerode for now
   ```

4. **Choose Sandbox Approach**
   - Decision: Hybrid approach (no Docker initially)
   - Use child processes instead of containers
   - File system in `/home/sandbox/projects/coco/workspaces/`

### Phase 1: Foundation (Week 1) - MODIFIED

**Changes from Master Plan:**
- ❌ Skip Docker integration
- ✅ Use Node.js child processes
- ✅ Use local file system
- ✅ Keep same API structure

**Implementation:**

```typescript
// Instead of Docker containers
import { spawn } from 'child_process';

class ProcessSandboxManager {
  async createSandbox(config) {
    // Create workspace directory
    const workspacePath = `/home/sandbox/projects/coco/workspaces/${config.workspaceId}`;
    await fs.mkdir(workspacePath, { recursive: true });
    
    // Start dev server as child process
    const devServer = spawn('npm', ['run', 'dev'], {
      cwd: workspacePath,
      env: { ...process.env, PORT: assignedPort }
    });
    
    return {
      sandboxId: generateId(),
      workspaceId: config.workspaceId,
      process: devServer,
      port: assignedPort,
    };
  }
}
```

### Phase 2-6: Continue as Planned

**No changes needed** - The rest of the master plan works with process-based sandboxing.

---

## 🗄️ Supabase Setup Required

### Missing Tables

According to master plan, we need:

#### 1. Workspaces Table
```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'nextjs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own workspaces"
  ON workspaces FOR ALL
  USING (auth.uid() = user_id);
```

#### 2. Sandbox Instances Table
```sql
CREATE TABLE sandbox_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('creating', 'starting', 'running', 'stopping', 'stopped', 'failed', 'destroying', 'destroyed')),
  container_id TEXT,
  preview_path TEXT,
  dev_server_port INTEGER,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sandbox_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access sandboxes for own workspaces"
  ON sandbox_instances FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );
```

#### 3. Sandbox Events Table
```sql
CREATE TABLE sandbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sandbox_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for own workspaces"
  ON sandbox_events FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );
```

### Supabase MCP

**Status:** Not currently connected

**To Connect:**
1. You need to authorize Henosia to connect to Supabase
2. Use the Supabase integration UI
3. This will enable MCP tools for database operations

**Without MCP:**
- We can still create migrations manually
- Run them via Supabase dashboard
- Or use Supabase CLI

---

## 📊 Summary & Recommendations

### Immediate Actions Required

1. **✅ Update `.env.local`**
   - Add Supabase URL
   - Add Supabase keys
   - Add runtime service URL

2. **✅ Create Supabase Migrations**
   - Workspaces table
   - Sandbox instances table
   - Sandbox events table

3. **✅ Install Dependencies**
   ```bash
   npm install @supabase/supabase-js express cors helmet ws
   ```

4. **✅ Choose Sandbox Approach**
   - **Recommended:** Hybrid (child processes)
   - Can upgrade to Docker later
   - Faster to implement

5. **✅ Create Workspace Directory**
   ```bash
   mkdir -p /home/sandbox/projects/coco/workspaces
   ```

### Modified Implementation Strategy

**Instead of:**
```
Docker Containers → Full isolation → Complex setup
```

**Use:**
```
Child Processes → Good isolation → Simple setup → Upgrade path to Docker
```

**Benefits:**
- ✅ No Docker dependency
- ✅ Works in current environment
- ✅ Faster to implement
- ✅ Can migrate to Docker later
- ✅ Same API structure

**Trade-offs:**
- ⚠️ Less isolation than Docker
- ⚠️ Shared file system
- ⚠️ Need process management

### Timeline Adjustment

**Original:** 8 weeks with Docker  
**Modified:** 6 weeks without Docker (faster!)

- Week 0: Environment setup (NEW)
- Week 1: Process-based sandbox
- Week 2: File operations & preview
- Week 3: Frontend integration
- Week 4: AI integration
- Week 5-6: Polish & testing

---

## 🎯 Next Steps

### Step 1: Environment Setup
1. Update `.env.local` with Supabase credentials
2. Create Supabase migrations
3. Install dependencies
4. Create workspace directory

### Step 2: Start Implementation
1. Create runtime service with process management
2. Implement state machine
3. Build file operations
4. Create preview proxy

### Step 3: Test & Iterate
1. Test workspace creation
2. Test file operations
3. Test preview
4. Test AI integration

---

## ❓ Questions for You

1. **Do you have Supabase Anon Key and Service Role Key?**
   - Need these for `.env.local`

2. **Should we proceed with child process approach?**
   - Or wait for Docker installation?

3. **Should I create the Supabase migrations now?**
   - Can do manually or wait for MCP connection

4. **Ready to start Phase 0 (Environment Setup)?**
   - Will take ~30 minutes

---

**Assessment Complete** ✅  
**Ready to proceed with modified plan** 🚀
