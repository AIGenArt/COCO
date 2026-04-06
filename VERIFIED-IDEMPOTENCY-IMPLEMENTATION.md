# Verified Idempotency Implementation

**Dato:** 6. april 2026  
**Status:** ✅ Implementeret

---

## Problem

Naive idempotency check reconnectede til sandboxes baseret kun på database status, hvilket resulterede i:
- Reconnect til sandboxes uden kørende dev server
- Preview returnerer 400 error
- Bootstrap kører aldrig

## Løsning: Verified Idempotency

En sandbox er KUN reusable hvis **ALLE** disse checks passerer:

### 5 Verification Checks

1. **DB Status Check**
   - Status må være `'running'`
   
2. **Preview Ready Check**
   - `preview_ready` må være `true`
   
3. **Container ID Check**
   - `container_id` må eksistere
   
4. **E2B Reconnect Check**
   - Reconnect til E2B provider må lykkes
   - Provider bekræfter sandbox er alive
   
5. **Preview Health Check**
   - HTTP request til preview URL må returnere 2xx/3xx
   - Response time < 5 sekunder

### Hvis Nogen Check Fejler

- Mark sandbox som `terminated`
- Set `preview_ready = false`
- Clear `workspaces.sandbox_id`
- Continue med fresh sandbox creation
- Kør fuld bootstrap

---

## Implementation

### 1. Central Verification Module

**Fil:** `lib/sandbox/sandbox-verification.ts`

```typescript
export async function verifySandboxReusable(
  sandbox: SandboxRecord
): Promise<VerificationResult> {
  // Check 1: DB status
  if (sandbox.status !== 'running') {
    return { reusable: false, shouldTerminate: true };
  }
  
  // Check 2: Preview ready
  if (!sandbox.preview_ready) {
    return { reusable: false, shouldTerminate: true };
  }
  
  // Check 3: Container ID
  if (!sandbox.container_id) {
    return { reusable: false, shouldTerminate: true };
  }
  
  // Check 4: E2B reconnect
  try {
    await E2BManager.getOrReconnectSandbox(sandbox.container_id);
  } catch (error) {
    return { reusable: false, shouldTerminate: true };
  }
  
  // Check 5: Preview health
  const healthResult = await checkPreviewHealth(previewUrl, 5000);
  if (healthResult.status !== 'ready') {
    return { reusable: false, shouldTerminate: true };
  }
  
  // All checks passed!
  return { reusable: true, shouldTerminate: false };
}
```

### 2. API Integration

**Fil:** `app/api/sandboxes/create/route.ts`

```typescript
// Check for existing sandboxes
const { data: existingSandboxes } = await supabase
  .from('sandbox_instances')
  .select('id, workspace_id, container_id, status, preview_ready, port, error_message')
  .eq('workspace_id', workspaceId)
  .in('status', ['creating', 'starting', 'running']);

if (existingSandboxes && existingSandboxes.length > 0) {
  const existingSandbox = existingSandboxes[0];
  
  // VERIFIED IDEMPOTENCY
  const verification = await verifySandboxReusable(existingSandbox);
  
  if (verification.reusable) {
    // Sandbox is verified healthy - reuse it
    return NextResponse.json({
      sandbox: existingSandbox,
      reconnected: true,
      verified: true,
    });
  } else {
    // Sandbox failed verification - terminate and create new
    await supabase
      .from('sandbox_instances')
      .update({ 
        status: 'terminated',
        preview_ready: false,
        error_message: `Verification failed: ${verification.reason}`
      })
      .eq('id', existingSandbox.id);
    
    // Continue to create new sandbox...
  }
}
```

---

## Benefits

### 1. Robust Reconnection
- Only reconnects to truly healthy sandboxes
- Prevents 400 errors from dead sandboxes

### 2. Automatic Cleanup
- Failed sandboxes are automatically terminated
- Database stays clean

### 3. Guaranteed Bootstrap
- Bootstrap always runs for new sandboxes
- Dev server always starts

### 4. Better Logging
- Detailed verification logs
- Easy to debug failures

---

## Test Scenarios

### Scenario 1: Healthy Sandbox Exists
```
1. User opens workspace
2. API finds existing sandbox
3. Verification runs:
   ✓ Status: running
   ✓ Preview ready: true
   ✓ Container ID: exists
   ✓ E2B reconnect: success
   ✓ Health check: 200 OK
4. Result: Reuse existing sandbox
5. Preview loads immediately
```

### Scenario 2: Unhealthy Sandbox Exists
```
1. User opens workspace
2. API finds existing sandbox
3. Verification runs:
   ✓ Status: running
   ✓ Preview ready: true
   ✓ Container ID: exists
   ✗ E2B reconnect: failed (sandbox expired)
4. Result: Mark as terminated, create new
5. Bootstrap runs
6. Dev server starts
7. Preview loads after ~60s
```

### Scenario 3: No Sandbox Exists
```
1. User opens workspace
2. API finds no existing sandbox
3. Create new sandbox
4. Bootstrap runs
5. Dev server starts
6. Preview loads after ~60s
```

---

## Monitoring

### Success Metrics
- ✅ Preview 200 response rate
- ✅ Sandbox reuse rate
- ✅ Bootstrap success rate
- ✅ Average time to preview ready

### Failure Metrics
- ❌ Verification failure rate
- ❌ E2B reconnect failure rate
- ❌ Health check failure rate
- ❌ Bootstrap failure rate

---

## Future Improvements

### 1. Caching
- Cache verification results for 30s
- Reduce redundant checks

### 2. Metrics
- Track verification check performance
- Identify common failure points

### 3. Auto-healing
- Automatically restart failed dev servers
- Retry failed health checks

### 4. Proactive Monitoring
- Background health checks
- Mark sandboxes as unhealthy before user access

---

## Files Modified

1. ✅ `lib/sandbox/sandbox-verification.ts` (NEW)
2. ✅ `app/api/sandboxes/create/route.ts` (UPDATED)
3. ✅ `VERIFIED-IDEMPOTENCY-IMPLEMENTATION.md` (NEW)

---

## Next Steps

1. ✅ Implementation complete
2. ⏳ Test with real workspace creation
3. ⏳ Monitor verification logs
4. ⏳ Verify preview works consistently

---

**Status:** Ready for testing  
**Expected Result:** Preview works on first try, every time
