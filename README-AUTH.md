# COCO Auth Flow Documentation

## Overview

COCO uses a simple, secure auth flow with Supabase authentication.

## Route Structure

```
/ (Landing)              → Public marketing page
  └─ If logged in       → Auto-redirect to /dashboard

/auth/login             → Public login page
/auth/sign-up           → Public signup page

/dashboard              → Protected (requires auth)
  └─ Workspace management + Create new workspace

/workspace?id=...       → Protected (requires auth)
  └─ Full IDE view
```

## Auth Flow

### New User Flow
1. User visits `/` (landing page)
2. Clicks "Sign Up" → `/auth/sign-up`
3. Creates account with email + password
4. Auto-redirected to `/dashboard`
5. Can create workspaces (max 2)

### Returning User Flow
1. User visits `/` (landing page)
2. Auto-redirected to `/dashboard` (if already logged in)
3. OR clicks "Sign In" → `/auth/login` → `/dashboard`

### Protected Routes
- `/dashboard` - Requires login, redirects to `/auth/login?redirectTo=/dashboard`
- `/workspace` - Requires login, redirects to `/auth/login?redirectTo=/workspace?id=...`

## Database Setup

### Required Migrations

The following migrations must be applied to your Supabase database:

1. `0003_ai_governance.sql` - AI governance tables
2. `0004_workspaces.sql` - Workspaces table
3. `0005_sandbox_instances.sql` - Sandbox instances table
4. `0006_sandbox_events.sql` - Sandbox events table

### How to Apply Migrations

**Option 1: Supabase Dashboard (Recommended)**

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste each migration file content
4. Run each migration in order (0003 → 0004 → 0005 → 0006)

**Option 2: Supabase CLI**

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push
```

### Verify Migrations

After applying migrations, verify the tables exist:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workspaces', 'sandbox_instances', 'sandbox_events', 'ai_policies', 'ai_actions');
```

You should see all 5 tables listed.

## Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key

# OpenRouter (for AI features)
OPENROUTER_API_KEY=your_openrouter_key

# AI Models
AI_MODEL_PLAN=deepseek/deepseek-chat
AI_MODEL_BUILD=deepseek/deepseek-v3

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron (for cleanup jobs)
CRON_SECRET=your_random_secret
```

## Supabase Configuration

### Email Confirmation

For development, disable email confirmation:

1. Go to Supabase Dashboard → Authentication → Settings
2. Find "Enable email confirmations"
3. Toggle OFF

This allows users to sign up and log in immediately without email verification.

### Row Level Security (RLS)

All tables have RLS enabled. Users can only access their own data:

- `workspaces` - Users see only their workspaces
- `sandbox_instances` - Users see only their sandbox instances
- `sandbox_events` - Users see only events for their workspaces

## Testing the Auth Flow

### 1. Test Landing Page
- Visit `/`
- Should see marketing page with "Sign In" and "Sign Up" buttons
- If already logged in, should auto-redirect to `/dashboard`

### 2. Test Sign Up
- Click "Sign Up" on landing page
- Enter email and password
- Should redirect to `/dashboard`
- Should see "0 / 2 workspaces"

### 3. Test Dashboard
- Should see prompt field to create workspace
- Create a workspace with a description
- Should redirect to `/workspace?id=...`

### 4. Test Logout
- Click on email in top bar
- Should log out and redirect to `/`

### 5. Test Login
- Click "Sign In" on landing page
- Enter credentials
- Should redirect to `/dashboard`
- Should see existing workspaces

## Troubleshooting

### 500 Error on Workspace Creation

**Cause:** Migrations not applied to database

**Solution:** Apply migrations using one of the methods above

### Infinite Redirect Loop

**Cause:** Middleware or auth check issue

**Solution:** 
1. Clear browser cookies
2. Check middleware.ts is correctly configured
3. Verify Supabase credentials in .env.local

### "Unauthorized" Error

**Cause:** User not logged in or session expired

**Solution:**
1. Log out and log back in
2. Check Supabase session is valid
3. Verify middleware is working

## Security Notes

- All passwords are hashed by Supabase
- Sessions are managed by Supabase Auth
- RLS policies prevent unauthorized data access
- Protected routes require valid session
- Middleware validates auth on every request

## Next Steps

After auth is working:

1. ✅ Auth flow complete
2. ⏭️ Build sandbox system (child process manager)
3. ⏭️ Implement file sync
4. ⏭️ Add preview proxy
5. ⏭️ Connect terminal output
