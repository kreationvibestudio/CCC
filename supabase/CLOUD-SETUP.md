# Supabase Cloud Setup

Your `.env.local` is already configured for project `ffccfeodymiwwqshphmh`.

## Automated setup (recommended)

With cloud credentials in `.env.local`:

```bash
npm run cloud:setup
```

Requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`, plus **one** of:

- `SUPABASE_DB_PASSWORD` — Supabase Dashboard → **Project Settings → Database → Database password**
- `SUPABASE_ACCESS_TOKEN` — [Account tokens](https://supabase.com/dashboard/account/tokens) (also enables disabling email confirmation)

Audit without changes:

```bash
npm run cloud:audit
```

The script is idempotent: it applies only missing schema, seed, migrations, admin user, storage bucket, and polling-unit import.

---

## Manual setup (if you prefer the dashboard)

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

## Step 7 — Polling unit migrations (Edo/Esan)

1. New SQL query in SQL Editor
2. Run **both** migrations in order:
   - `supabase/migrations/20250201000000_polling_units_geocode.sql`
   - `supabase/migrations/20250202000000_polling_units_inec_fields.sql`

This adds `geocode_status`, INEC code columns (`state_code`, `lg_code`, `ward_code`, `pu_code`), indexes, and `campaign_locations`.

## Step 8 — Import Edo polling units

**Option A — Dashboard UI:** Polling Units → **Import CSV** (upload `supabase/data/edo-polling-units.csv` — all 18 Edo LGAs including Esan Central).

**Option B — CLI** (requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`):

```bash
npm run pu:import
npm run pu:geocode -- --limit=50
```

Uses `supabase/data/edo-polling-units.csv` by default (**4,711** PUs). See [docs/PU-IMPORT.md](../docs/PU-IMPORT.md).

## Step 9 — Storage bucket (agent result photos)

1. **Storage → New bucket** → name: `election-media`
2. Set **Public** or add RLS policy so authenticated agents can upload to their tenant folder

## Step 10 — Termii SMS (optional)

Add `TERMII_API_KEY` and `TERMII_SENDER_ID` to Vercel env vars. See [docs/TERMII-SETUP.md](../docs/TERMII-SETUP.md).
