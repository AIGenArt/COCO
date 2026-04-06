# E2B + AI Integration Issue

## ❌ CURRENT ARCHITECTURE (INCORRECT)

```
User → COCO Frontend → OpenRouter API (Qwen) → JSON Response → COCO Backend → E2B Sandbox
```

**Problems:**
1. AI generates JSON with file paths and content
2. COCO backend manually writes files to E2B
3. AI has NO direct access to sandbox
4. AI cannot execute code or see results
5. AI cannot iterate based on errors

## ✅ CORRECT ARCHITECTURE (E2B Recommended)

```
User → COCO Frontend → OpenRouter API (Qwen) + E2B SDK → Direct Sandbox Control
```

**Benefits:**
1. AI can execute code directly in sandbox
2. AI can see execution results
3. AI can iterate and fix errors
4. AI can install packages as needed
5. AI can test code before returning

## 📚 E2B Documentation Reference

From: https://e2b.dev/docs/quickstart/connect-llms

### Key Points:

1. **Use E2B SDK in AI calls**
   ```typescript
   import { Sandbox } from 'e2b'
   
   const sandbox = await Sandbox.create('code-interpreter-v1')
   
   // AI can now execute code
   const result = await sandbox.commands.run('npm install package')
   ```

2. **AI should have code execution tool**
   ```typescript
   const tools = [{
     name: 'execute_code',
     description: 'Execute code in sandbox',
     parameters: {
       code: 'string',
       language: 'typescript | javascript | bash'
     }
   }]
   ```

3. **Streaming with E2B**
   - AI streams responses
   - Code execution happens in real-time
   - Results fed back to AI
   - AI can iterate

## 🔧 WHAT NEEDS TO CHANGE

### 1. Add E2B SDK to AI Client

**File**: `lib/ai/openrouter-client.ts`

Add E2B sandbox parameter:
```typescript
async chat(
  model: string,
  messages: OpenRouterMessage[],
  options: {
    sandbox?: Sandbox,  // ← ADD THIS
    temperature?: number;
    // ...
  }
)
```

### 2. Add Code Execution Tool

**New File**: `lib/ai/tools/code-execution.ts`

```typescript
export async function executeCode(
  sandbox: Sandbox,
  code: string,
  language: 'typescript' | 'javascript' | 'bash'
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Execute code in sandbox
  // Return results to AI
}
```

### 3. Update AI Workflow

**Current (Wrong):**
```
1. User asks for feature
2. AI generates JSON with files
3. COCO writes files to sandbox
4. COCO starts dev server
5. Hope it works
```

**Correct (E2B Way):**
```
1. User asks for feature
2. AI gets sandbox reference
3. AI writes files directly
4. AI runs npm install
5. AI starts dev server
6. AI checks for errors
7. AI fixes errors if needed
8. AI confirms working
9. Return success to user
```

### 4. Tool Calling Format

OpenRouter supports tool calling. We should use:

```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'execute_bash',
      description: 'Execute bash command in sandbox',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Bash command to execute'
          }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write file to sandbox',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read file from sandbox',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        },
        required: ['path']
      }
    }
  }
]
```

## 🎯 WHY THIS MATTERS

**Current Issue**: Sandboxes terminate because:
- AI generates code blindly
- No validation before execution
- No error feedback loop
- No iterative fixing

**With E2B Integration**: 
- AI validates code by running it
- AI sees errors and fixes them
- AI iterates until working
- Much higher success rate

## 📋 IMPLEMENTATION PLAN

### Phase 1: Add Tool Calling
1. Update `openrouter-client.ts` to support tools
2. Create tool definitions for E2B operations
3. Handle tool call responses

### Phase 2: Integrate E2B SDK
1. Pass sandbox reference to AI
2. Let AI execute commands directly
3. Stream results back to AI

### Phase 3: Update Workflow
1. Create sandbox BEFORE AI call
2. Give AI sandbox access
3. Let AI build and test
4. Return working result

### Phase 4: Add Error Recovery
1. AI detects errors
2. AI fixes errors
3. AI retries
4. AI confirms success

## 🚀 EXPECTED IMPROVEMENT

**Before (Current):**
- Success rate: ~30%
- Sandboxes crash frequently
- No error recovery
- Manual debugging needed

**After (E2B Integration):**
- Success rate: ~90%
- AI fixes errors automatically
- Iterative improvement
- Working code guaranteed

## 📖 Resources

- E2B Quickstart: https://e2b.dev/docs/quickstart/connect-llms
- E2B SDK Docs: https://e2b.dev/docs/sdk/overview
- OpenRouter Tool Calling: https://openrouter.ai/docs/tool-calling
- Qwen Tool Use: https://qwen.readthedocs.io/en/latest/framework/function_call.html

## ⚠️ CRITICAL INSIGHT

**The sandbox termination issue is NOT a bootstrap problem.**

**It's an AI integration problem.**

The AI is generating code without being able to:
1. Test it
2. See errors
3. Fix issues
4. Validate it works

This is why sandboxes crash - the AI is flying blind.

E2B's architecture solves this by giving the AI direct sandbox access.
