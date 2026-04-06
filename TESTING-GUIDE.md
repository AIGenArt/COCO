# COCO Sandbox Bootstrap Testing Guide

## Current Status
✅ Sandbox auto-start has been RE-ENABLED in the workspace UI
✅ Bootstrap architecture is implemented
✅ User is authenticated (ID: 7c0d1644-6080-4e03-bd82-e60a323d64af)

## Test Steps

### 1. Create a New Workspace

1. Go to `/dashboard` (you're already there)
2. Enter a prompt like: "Build a simple landing page"
3. Click "Create Workspace"
4. Watch the console logs

**Expected Flow:**
```
[Dashboard] Creating workspace...
[Dashboard] Workspace created: <workspace-id>
[Dashboard] Creating sandbox...
[API] POST /api/sandboxes/create called
[API] Step 1: Creating Supabase client...
[API] Step 2: Checking authentication...
[API] Step 3: Parsing request body...
[API] Step 4: Verifying workspace ownership...
[API] Step 5: Checking for existing sandboxes...
[API] Step 6: Creating new sandbox...
[E2B] Creating sandbox for workspace...
[E2B] ✓ Sandbox created: <sandbox-id>
[Sandbox Create] Generating template files...
[Sandbox Create] Writing files to sandbox...
[Sandbox Create] Starting Next.js dev server...
[E2B] Step 1/4: Bootstrapping workspace...
[Bootstrap] Phase: prepare_source
[Bootstrap] Phase: materialize_files
[Bootstrap] Writing 8 files...
[Bootstrap] ✓ Wrote package.json
[Bootstrap] ✓ Wrote tsconfig.json
[Bootstrap] ✓ Wrote next.config.mjs
[Bootstrap] ✓ Wrote tailwind.config.ts
[Bootstrap] ✓ Wrote postcss.config.mjs
[Bootstrap] ✓ Wrote app/globals.css
[Bootstrap] ✓ Wrote app/layout.tsx
[Bootstrap] ✓ Wrote app/page.tsx
[Bootstrap] Phase: validate_structure
[Bootstrap] Validating workspace structure...
[Bootstrap] ✓ Validation passed. All required files present.
[E2B] ✓ Step 1/4: Workspace bootstrapped and validated
[E2B] Step 2/4: Installing dependencies...
[E2B] ✓ Step 2/4: Dependencies installed successfully
[E2B] Step 3/4: Starting dev server...
[E2B] ✓ Step 3/4: Dev server command started
[E2B] Step 4/4: Waiting for health check...
[E2B] Health check attempt 1: checking
[E2B] Health check attempt 2: checking
[E2B] ✓ Step 4/4: Health check passed - preview is ready!
[Workspace] ✓ Sandbox created: <sandbox-id>
[Workspace] Status: starting
```

### 2. What to Look For

**✅ SUCCESS Indicators:**
- All 8 files written successfully
- Validation passes (no missing files)
- npm install completes
- Dev server starts
- Health check passes
- Preview shows "Hello COCO!" page

**❌ FAILURE Indicators:**
- "Missing files" error during validation
- "Bootstrap failed at phase X" error
- npm install timeout
- Health check timeout
- Preview shows blank page or COCO platform

### 3. Common Issues & Solutions

#### Issue: "Missing app/layout.tsx"
**Cause:** Template generator not writing file OR validation checking too early
**Solution:** Check bootstrap logs to see if file was written

#### Issue: "npm install timeout"
**Cause:** E2B sandbox slow or network issues
**Solution:** Increase timeout in e2b-manager.ts

#### Issue: "Health check failed"
**Cause:** Dev server not starting OR wrong port
**Solution:** Check dev server logs, verify port 3000

#### Issue: Preview shows COCO platform instead of workspace
**Cause:** Preview proxy routing to wrong URL
**Solution:** Check Preview component and proxy route

### 4. Manual Testing Commands

If you want to test without the UI:

```bash
# Check if E2B API key is valid
echo $E2B_API_KEY

# Test workspace creation API
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","description":"Test workspace","template":"nextjs"}'

# Test sandbox creation API (replace WORKSPACE_ID)
curl -X POST http://localhost:3000/api/sandboxes/create \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"WORKSPACE_ID"}'
```

### 5. Debugging Tips

**View Server Logs:**
- Check terminal where `npm run dev` is running
- Look for [E2B], [Bootstrap], [Sandbox Create] prefixes

**View Browser Console:**
- Open DevTools (F12)
- Check Console tab for [Workspace] logs
- Check Network tab for API calls

**Check Database:**
- Sandbox instances table should show new record
- Status should transition: creating → starting → running
- Check sandbox_events table for detailed logs

### 6. Expected Timeline

- Workspace creation: ~1 second
- Sandbox creation: ~5-10 seconds
- Bootstrap + validation: ~2 seconds
- npm install: ~30-60 seconds
- Dev server start: ~10-20 seconds
- Health check: ~5-10 seconds

**Total: ~1-2 minutes from click to ready**

### 7. Next Steps After Success

Once bootstrap works:

1. **Test file sync:**
   - Edit a file in Monaco editor
   - Verify changes appear in preview

2. **Test AI integration:**
   - Use AI to create a new component
   - Verify it writes to sandbox
   - Verify preview updates

3. **Test terminal:**
   - Run commands in terminal
   - Verify output streams correctly

## Ready to Test?

1. Go to `/dashboard`
2. Click "Create Workspace"
3. Watch the magic happen! 🎉

If anything fails, check the logs and report back with:
- Which phase failed
- Error message
- Server logs
- Browser console logs
