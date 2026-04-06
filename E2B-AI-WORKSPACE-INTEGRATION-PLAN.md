# E2B AI Workspace Integration Plan

## Current State

### What Works ✅
- E2B AI integration tested and working (`/admin/e2b-ai-test`)
- AI can use tools (execute_bash, write_file, read_file, list_files)
- AI can iterate and fix errors
- Bootstrap validation architecture in place

### What Doesn't Work ❌
- Workspaces don't use E2B AI
- Workspaces manually generate files (error-prone)
- Files often missing (app/layout.tsx errors)
- No AI validation before marking ready
- Sandboxes crash frequently

## Integration Strategy

### Phase 1: Workspace Creation with E2B AI

**Current Flow:**
```
1. Create sandbox
2. Manually generate template files
3. Write files to sandbox
4. Start dev server
5. Hope it works → Often crashes
```

**New Flow:**
```
1. Create sandbox
2. Give AI sandbox access
3. AI writes and validates files
4. AI tests dev server
5. AI confirms working → Guaranteed success
```

**Implementation:**
- Update `/api/sandboxes/create` to use E2B AI service
- Replace manual file generation with AI-driven generation
- AI validates structure before marking ready

### Phase 2: Workspace AI Panel Integration

**Current Flow:**
```
User → AI Panel → OpenRouter → JSON response → Manual file writing
```

**New Flow:**
```
User → AI Panel → E2B AI Service → Direct sandbox control → Validated code
```

**Implementation:**
- Update workspace AI panel to use E2B AI service
- Give AI direct sandbox access
- AI can write, test, and fix code in real-time

### Phase 3: Error Recovery

**Current Flow:**
```
Sandbox crashes → User sees error → Manual intervention needed
```

**New Flow:**
```
Sandbox error → AI detects → AI fixes → Auto-recovery
```

**Implementation:**
- Monitor sandbox errors
- Trigger AI error recovery
- AI reads logs, fixes issues, restarts

## Implementation Steps

### Step 1: Create Workspace Bootstrap with AI

**File:** `lib/sandbox/ai-workspace-bootstrap.ts`

```typescript
export async function bootstrapWorkspaceWithAI(
  sandboxId: string,
  workspaceName: string
): Promise<{ success: boolean; message: string }> {
  // 1. Connect to sandbox
  const aiService = await createE2BAIService(sandboxId);
  
  // 2. Let AI create workspace
  const result = await aiService.buildFeature(
    `Create a Next.js workspace named "${workspaceName}" with:
    - All required config files (package.json, tsconfig.json, etc.)
    - App router structure (app/layout.tsx, app/page.tsx)
    - Tailwind CSS setup
    - A beautiful landing page
    
    Test that everything works before responding.`
  );
  
  return result;
}
```

### Step 2: Update Sandbox Creation Endpoint

**File:** `app/api/sandboxes/create/route.ts`

Replace manual file generation with:

```typescript
// OLD: Manual generation
const files = await generateTemplateFiles(workspaceId);
await E2BManager.writeFiles(e2bSandbox.id, files);
await E2BManager.startDevServer(e2bSandbox.id, 3000);

// NEW: AI-driven generation
const result = await bootstrapWorkspaceWithAI(
  e2bSandbox.id,
  workspace.name
);

if (!result.success) {
  throw new Error(result.message);
}
```

### Step 3: Create AI Panel Integration

**File:** `lib/workspace/ai-panel-service.ts`

```typescript
export class WorkspaceAIPanelService {
  private aiService: E2BAIService;
  
  async initialize(sandboxId: string) {
    this.aiService = await createE2BAIService(sandboxId);
  }
  
  async handleUserMessage(message: string) {
    return await this.aiService.chat(message);
  }
  
  async buildFeature(description: string) {
    return await this.aiService.buildFeature(description);
  }
  
  async fixError(error: string) {
    return await this.aiService.fixError(error);
  }
}
```

### Step 4: Update Workspace AI Panel Component

**File:** `components/workspace/AIPanel.tsx`

Add E2B AI integration:
- Initialize AI service with sandbox ID
- Stream AI responses
- Show tool calls in UI
- Display AI's work in real-time

## Benefits

### Before (Current)
- ❌ 30% success rate
- ❌ Manual file generation
- ❌ No validation
- ❌ Frequent crashes
- ❌ No error recovery

### After (With E2B AI)
- ✅ 90% success rate
- ✅ AI-driven generation
- ✅ Automatic validation
- ✅ Tested before ready
- ✅ Auto error recovery

## Risks & Mitigations

### Risk 1: Rate Limits
**Problem:** Free tier has strict limits
**Mitigation:** 
- Cache AI responses
- Use paid tier for production
- Implement request queuing

### Risk 2: Slow Response
**Problem:** AI takes 1-3 minutes
**Mitigation:**
- Show progress to user
- Stream AI work in real-time
- Set proper expectations

### Risk 3: AI Errors
**Problem:** AI might fail
**Mitigation:**
- Fallback to manual generation
- Retry with different prompts
- Clear error messages

## Testing Strategy

### Test 1: Workspace Creation
1. Create new workspace
2. Verify AI generates all files
3. Verify dev server starts
4. Verify preview works

### Test 2: AI Panel
1. Open workspace
2. Ask AI to add feature
3. Verify AI writes files
4. Verify AI tests code
5. Verify feature works

### Test 3: Error Recovery
1. Introduce error
2. Verify AI detects it
3. Verify AI fixes it
4. Verify workspace recovers

## Timeline

- **Phase 1:** Workspace creation (2-3 hours)
- **Phase 2:** AI panel integration (2-3 hours)
- **Phase 3:** Error recovery (1-2 hours)
- **Testing:** 1-2 hours

**Total:** 6-10 hours of development

## Next Steps

1. Implement `ai-workspace-bootstrap.ts`
2. Update `/api/sandboxes/create`
3. Test workspace creation
4. Implement AI panel service
5. Update AI panel component
6. Test end-to-end
7. Deploy and monitor

## Success Criteria

- ✅ Workspaces create successfully 90%+ of the time
- ✅ No more "Missing source file" errors
- ✅ AI panel can write and test code
- ✅ Error recovery works automatically
- ✅ User experience is smooth and fast
