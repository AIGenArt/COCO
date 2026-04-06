# Sandbox Cleanup Cron Job

## Overview

The sandbox cleanup system automatically marks stale sandboxes as `failed` when they stop sending heartbeats. This prevents zombie sandboxes from consuming resources.

## Endpoint

```
POST /api/sandboxes/cleanup
```

## Authentication

Protected by `CRON_SECRET` header:

```bash
curl -X POST https://your-domain.com/api/sandboxes/cleanup \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## Configuration

### Environment Variables

**Development** (`.env.local`):
```bash
CRON_SECRET=coco_cleanup_secret_a8f3d9e2b7c4f1a6e9d2b5c8f3a7e1d4b9c6f2a8e5d1b7c4f9a3e6d2b8c5f1a7
```

**Production** (Deployment Secrets):
```bash
CRON_SECRET=<generate-new-long-random-string>
```

**Generate a secure secret**:
```bash
openssl rand -base64 32
```

## Cleanup Logic

### What Gets Cleaned Up

Sandboxes are marked as `failed` if:
- Status is `running`
- `last_seen_at` is older than 90 seconds (3 missed heartbeats)

### Cleanup Flow

```
1. Find stale sandboxes (no heartbeat > 90s)
2. Transition each to 'failed' state
3. Log 'heartbeat_missed' event
4. Return count of cleaned sandboxes
```

### State Transitions

```
running (stale) → failed → destroying → destroyed
```

**Note**: Cleanup only marks as `failed`. Actual destruction happens separately.

## Idempotency

✅ **Safe to run multiple times**

- Already failed sandboxes are skipped
- No duplicate state transitions
- Cleanup can be called repeatedly without harm

## Scheduling

### Recommended Schedule

Run every **5 minutes**:

```cron
*/5 * * * *
```

### Platform-Specific Setup

#### Vercel Cron Jobs

**vercel.json**:
```json
{
  "crons": [
    {
      "path": "/api/sandboxes/cleanup",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Note**: Add `CRON_SECRET` to Vercel environment variables.

#### GitHub Actions

**.github/workflows/cleanup-cron.yml**:
```yaml
name: Sandbox Cleanup

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Call cleanup endpoint
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/sandboxes/cleanup \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

#### Custom Cron (Linux)

```bash
# Edit crontab
crontab -e

# Add line
*/5 * * * * curl -X POST https://your-domain.com/api/sandboxes/cleanup -H "x-cron-secret: YOUR_SECRET"
```

## Response Format

### Success

```json
{
  "message": "Cleanup completed",
  "cleanedCount": 3,
  "timestamp": "2026-03-21T10:30:00.000Z"
}
```

### Unauthorized

```json
{
  "error": "Unauthorized"
}
```

**Status**: 401

## Monitoring

### Logs

Cleanup logs are written to console:

```
Starting sandbox cleanup...
Cleaned up 3 stale sandbox(es)
Sandbox cleanup complete: 3 sandbox(es) cleaned
```

### Events

Each cleaned sandbox generates a `heartbeat_missed` event in `sandbox_events` table:

```sql
SELECT * FROM sandbox_events 
WHERE event_type = 'heartbeat_missed' 
ORDER BY created_at DESC;
```

## Testing

### Manual Test

```bash
# Set your CRON_SECRET
export CRON_SECRET="your-secret-here"

# Call cleanup endpoint
curl -X POST http://localhost:3000/api/sandboxes/cleanup \
  -H "x-cron-secret: $CRON_SECRET" \
  -v
```

### Expected Behavior

1. Returns 200 OK
2. Shows `cleanedCount` in response
3. Logs cleanup activity
4. Stale sandboxes marked as `failed`

## Security

### Best Practices

1. ✅ **Never commit CRON_SECRET to git**
2. ✅ **Use different secrets for dev/prod**
3. ✅ **Rotate secret if compromised**
4. ✅ **Use long random strings (32+ chars)**
5. ✅ **Store in deployment secrets, not code**

### Secret Rotation

If secret is compromised:

1. Generate new secret: `openssl rand -base64 32`
2. Update `.env.local` (dev)
3. Update deployment secrets (prod)
4. Update cron job configuration
5. Restart application

## Troubleshooting

### Cleanup Not Running

**Check**:
- CRON_SECRET matches in both cron job and deployment
- Cron schedule is correct
- Endpoint is accessible
- Logs for errors

### No Sandboxes Cleaned

**Possible Reasons**:
- No stale sandboxes exist (good!)
- Heartbeats are working correctly
- Threshold not reached (< 90 seconds)

### Unauthorized Errors

**Fix**:
- Verify CRON_SECRET is set correctly
- Check header name is `x-cron-secret`
- Ensure secret matches deployment

## Maintenance

### Regular Tasks

1. **Monitor cleanup logs** - Check for unusual patterns
2. **Review stale sandbox count** - High numbers may indicate issues
3. **Verify cron job runs** - Ensure scheduled execution
4. **Rotate secrets periodically** - Security best practice

### Metrics to Track

- Cleanup frequency
- Average sandboxes cleaned per run
- Failed cleanup attempts
- Heartbeat miss rate

## Related Documentation

- [Sandbox Architecture](./sandbox-architecture.md)
- [Sandbox State Machine](../lib/sandbox/types.ts)
- [Heartbeat System](../lib/sandbox/use-sandbox-heartbeat.ts)
