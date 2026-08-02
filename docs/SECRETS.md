# Secrets storage (gitignored)

This folder holds **local backups** of `.env.local`. Nothing here is committed to Git.

| File | Purpose |
|------|---------|
| `latest.env.local` | Most recent backup — use `npm run secrets:restore` |
| `env-*.local` | Timestamped archives |

## Commands

```bash
npm run secrets:backup      # after updating .env.local
npm run secrets:restore     # restore on a new machine / after loss
npm run secrets:github      # push to GitHub Actions secrets (backup)
npm run secrets:vercel-pull # pull from Vercel production
npm run secrets:list        # show keys (no values)
```

## Where secrets live

| Location | Use |
|----------|-----|
| `.env.local` | Active local dev (gitignored) |
| `secrets/` | Local backup vault (gitignored) |
| **Vercel** | Production runtime — [ccc env vars](https://vercel.com/kreation-vibe-studios-projects/ccc/settings/environment-variables) |
| **GitHub Secrets** | Disaster backup / future CI — Settings → Secrets → Actions |

Never commit real tokens to the repo. Use `.env.example` as the template only.
