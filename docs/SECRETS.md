# Secrets management (Git + GitHub)

Secrets are **never committed to git**. They live in GitHub Secrets and a local gitignored backup.

## Storage

| Location | Git tracked? | Purpose |
|----------|--------------|---------|
| `.env.local` | No (gitignored) | Active local dev |
| `secrets/` | No (gitignored) | Local backup on disk |
| [GitHub Secrets](https://github.com/kreationvibestudio/CCC/settings/secrets/actions) | No values in repo | Remote vault / CI |
| [Vercel env vars](https://vercel.com/kreation-vibe-studios-projects/ccc/settings/environment-variables) | No | Production runtime |

Use **Git Bash** (not PowerShell) for all commands below.

## Windows local copy

Canonical path on the campaign PC:

```text
D:\CCC
```

In Git Bash: `cd /d/CCC` — see [LOCAL-WINDOWS.md](./LOCAL-WINDOWS.md) for clone, secrets restore, and `npm run dev`.

## Git Bash commands

```bash
# After updating .env.local
./scripts/secrets.sh backup
./scripts/secrets.sh github

# Restore on a new machine
./scripts/secrets.sh restore

# See what's configured (no values shown)
./scripts/secrets.sh list
```

Or via npm (works in Git Bash too):

```bash
npm run secrets:backup
npm run secrets:github
npm run secrets:restore
npm run secrets:list
```

## Push a single secret with gh

```bash
gh secret set FACEBOOK_USER_ACCESS_TOKEN --repo kreationvibestudio/CCC
# paste value when prompted
```

## Pull from Vercel into local

```bash
npx vercel env pull .env.local --yes
./scripts/secrets.sh backup
```

## New machine setup

```bash
git clone https://github.com/kreationvibestudio/CCC.git
cd CCC
cp .env.example .env.local
# Paste secrets from your password manager or run restore if secrets/ was copied
./scripts/secrets.sh restore   # if you have a local backup
npm install
npm run dev
```

## Production checklist (CCC)

| Variable | Required for |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` / anon / `SUPABASE_SERVICE_ROLE_KEY` | App + Admin invite |
| `NEXT_PUBLIC_APP_URL` | Auth redirects, QR check-in links (**must be the Vercel URL in production, not localhost**) |
| `CRON_SECRET` | Daily Facebook sync (`Authorization: Bearer`; set on Vercel so Cron injects it) |
| `TERMII_API_KEY` / `TERMII_SENDER_ID` | Communications SMS send |
| `PAYSTACK_SECRET_KEY` | Optional: auto-record Paystack charges into CRM |
| `FACEBOOK_*` | Social sync / comments |
| `OPENAI_API_KEY` | AI assistant (optional) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional Maps SDK |

After setting keys locally, mirror them to **GitHub Secrets** and **Vercel**. Confirm with Admin → Secrets readiness (booleans only).

## Rules

- Never `git add .env.local` or `secrets/`
- `.env.example` is the template only (no real values)
- When Facebook tokens expire: update `.env.local`, then `backup` + `github` + update Vercel
