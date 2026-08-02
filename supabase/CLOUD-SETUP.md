# Supabase Cloud Setup

Your `.env.local` is already configured for project `ffccfeodymiwwqshphmh`.

## Step 1 — Run the schema (fixed for Cloud)

1. Open: https://supabase.com/dashboard/project/ffccfeodymiwwqshphmh/sql/new
2. Copy **all** of `supabase/migrations/20250101000000_initial_schema.sql`
3. Paste → **Run**

If you get "already exists" errors from a partial earlier run, skip to Step 1b.

### Step 1b — Fresh start (only if Step 1 failed partway)

In SQL Editor run:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
```
Then repeat Step 1.

## Step 2 — Run seed data

1. New SQL query
2. Copy **all** of `supabase/seed.sql`
3. Paste → **Run**

## Step 3 — Create admin user (Dashboard UI)

1. Go to **Authentication → Users**
2. Click **Add user → Create new user**
3. Fill in:
   - Email: `admin@demo.campaign.ng`
   - Password: `DemoPassword123!`
   - ✅ **Auto Confirm User** (turn ON)
4. Click **Create user**

## Step 4 — Make that user an admin

1. New SQL query
2. Copy **all** of `supabase/cloud-admin.sql`
3. Paste → **Run**

## Step 5 — Disable email confirmation

1. **Authentication → Providers → Email**
2. Turn OFF **Confirm email** → Save

## Step 6 — Restart app

```bash
npm run dev
```

Login at http://localhost:3000/login with:
- `admin@demo.campaign.ng`
- `DemoPassword123!`
