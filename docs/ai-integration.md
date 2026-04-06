# AI Integration Guide

COCO uses OpenRouter + DeepSeek for AI-powered code generation and planning.

## Setup

### 1. Get OpenRouter API Key

1. Go to https://openrouter.ai/keys
2. Sign up or log in
3. Create a new API key
4. Copy the key

### 2. Configure Environment

```bash
# Copy example env file
cp .env.local.example .env.local

# Edit .env.local and add your key
OPENROUTER_API_KEY=sk-or-v1-...
```

### 3. Restart Dev Server

```bash
npm run dev
```

## How It Works

### Plan Mode (deepseek/deepseek-chat)

When user types a prompt in Plan mode:

1. **Frontend** → `TaskPanel` sends prompt to backend
2. **Backend** → `/api/ai/prompt/plan` calls OpenRouter
3. **DeepSeek** analyzes prompt and returns structured plan:
   ```json
   {
     "summary": "I'll create a Hero component...",
     "actions": [
       {
         "type": "write_file",
         "path": "components/Hero.tsx",
         "description": "Hero section component",
         "content": "export function Hero() { ... }"
       }
     ]
   }
   ```
4. **Frontend** displays plan with "Build This" button

### Build Mode (deepseek/deepseek-v3)

When user clicks "Build This":

1. **Frontend** switches to Build mode
2. **Backend** → `/api/ai/prompt/execute` validates plan
3. **Action Executor** creates/updates files in workspace
4. **Terminal** shows progress
5. **Editor** unlocks when done

## Architecture

```
User Prompt
    ↓
TaskPanel (frontend)
    ↓
ai-service.ts (rate limiting + debounce)
    ↓
/api/ai/prompt/plan (backend)
    ↓
openrouter-client.ts
    ↓
OpenRouter API
    ↓
DeepSeek Model
    ↓
Structured JSON Response
    ↓
Frontend displays plan
    ↓
User approves
    ↓
action-executor.ts
    ↓
workspace-store.ts (creates files)
    ↓
UI updates
```

## Models

### deepseek/deepseek-chat (Plan Mode)
- **Purpose:** Analysis, planning, reasoning
- **Temperature:** 0.7 (creative)
- **Max Tokens:** 4000
- **JSON Mode:** Enabled

### deepseek/deepseek-v3 (Build Mode)
- **Purpose:** Code generation, execution
- **Temperature:** 0.3 (consistent)
- **Max Tokens:** 8000
- **JSON Mode:** Enabled

## Prompt Engineering

### System Prompt (Plan Mode)

```
You are an expert coding assistant for COCO.

Return JSON:
{
  "summary": "Brief description",
  "actions": [
    {
      "type": "write_file",
      "path": "path/to/file.tsx",
      "description": "What this does",
      "content": "// Full code"
    }
  ]
}

Guidelines:
- TypeScript + React
- Next.js App Router
- Tailwind CSS
- Complete, working code
```

### User Prompt Format

```
{user_request}

Current workspace context:
{
  "currentFiles": ["app/page.tsx", "components/..."],
  "mode": "plan"
}
```

## Error Handling

### Fallback Strategy

If OpenRouter fails:
1. Log error to console
2. Fall back to pattern matching
3. Return basic plan
4. User can still build

### Rate Limiting

- **Debounce:** 800ms (prevents spam)
- **Min Interval:** 1 second between requests
- **Burst Protection:** Max 10 requests per 30 seconds
- **Queue:** Requests queued if rate limited

## Security

✅ **API Key in Backend Only**
- Never exposed to frontend
- Stored in .env.local
- Not committed to git

✅ **Request Validation**
- Validate prompt + workspaceId
- Check plan ownership
- Prevent unauthorized execution

✅ **Audit Trail**
- All AI requests logged
- Plan creation tracked
- Execution results stored

## Testing

### Test Plan Generation

```bash
# In COCO workspace
1. Type: "create a hero section"
2. Wait for plan
3. Check actions are valid
4. Verify file paths are correct
```

### Test Build Execution

```bash
1. Click "Build This"
2. Watch terminal logs
3. Check files created
4. Verify code quality
```

## Troubleshooting

### "OpenRouter API key not configured"

**Solution:** Add `OPENROUTER_API_KEY` to `.env.local`

### "AI planning error"

**Solution:** Check:
1. API key is valid
2. OpenRouter has credits
3. Model name is correct
4. Network connection works

### "Editor is locked"

**Fixed!** Action executor now allows AI to execute during build.

### Plan returns generic component

**Solution:** 
- Improve prompt specificity
- Add more context
- Or: AI is working, just needs better prompt

## Cost Optimization

### Free Tier

OpenRouter offers free models:
- DeepSeek models are very affordable
- Free tier available for testing

### Best Practices

1. **Debounce prompts** (already implemented)
2. **Cache plans** (in memory, will add Supabase)
3. **Reuse plans** (don't regenerate unnecessarily)
4. **Limit token usage** (reasonable max_tokens)

## Future Enhancements

### Phase 2
- [ ] Streaming responses
- [ ] Real-time progress updates
- [ ] Multi-file context awareness
- [ ] Code refactoring suggestions

### Phase 3
- [ ] Custom model selection
- [ ] Fine-tuned models
- [ ] Local model support
- [ ] Advanced prompt templates

## Resources

- [OpenRouter Docs](https://openrouter.ai/docs)
- [DeepSeek Models](https://openrouter.ai/models?q=deepseek)
- [OpenAI API Compatibility](https://openrouter.ai/docs#openai-compatibility)
