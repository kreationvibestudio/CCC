# Local Windows copy — `D:\CCC`

This repo’s **canonical local machine path** is:

```text
D:\CCC
```

Use **Git Bash** (not PowerShell) for the commands below.

## 1. Get the code onto `D:\CCC`

Open **Git Bash**, then pick the case that matches your folder.

### A) Folder exists but is empty (or only has `.env.local` / `secrets`)

```bash
cd /d/CCC
git status
```

If you see `not a git repository`:

```bash
cd /d/CCC
git init
git remote add origin https://github.com/kreationvibestudio/CCC.git
git fetch origin
git checkout -B main origin/main
```

If Git complains the folder isn’t empty, keep your env files and force the tree from GitHub:

```bash
cd /d/CCC
# keep credentials if present
cp -n .env.local /tmp/ccc-env.local.bak 2>/dev/null || true
cp -a secrets /tmp/ccc-secrets.bak 2>/dev/null || true

git init
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/kreationvibestudio/CCC.git
git fetch origin
git checkout -f -B main origin/main

# restore credentials
cp -n /tmp/ccc-env.local.bak .env.local 2>/dev/null || true
cp -a /tmp/ccc-secrets.bak secrets 2>/dev/null || true
```

### B) Folder already is this GitHub repo

```bash
cd /d/CCC
git remote -v
git checkout main
git pull origin main
```

### C) Fresh clone into a new folder (simplest if `D:\CCC` is a mess)

```bash
# In File Explorer: rename D:\CCC to D:\CCC-old (keeps your files)
mkdir -p /d/CCC
cd /d/CCC
git clone https://github.com/kreationvibestudio/CCC.git .
# Then copy .env.local from D:\CCC-old into D:\CCC if you had one
```

### Common errors

| Error | Fix |
|-------|-----|
| `fatal: destination path '.' already exists and is not an empty directory` | Don’t use `git clone .` into a non-empty folder — use **A** (`git init` + `fetch` + `checkout`) or **C** |
| `fatal: not a git repository` | Use **A** |
| `refusing to merge unrelated histories` | Use the `git checkout -f -B main origin/main` steps in **A** |
| `Permission denied` / path not found | In Git Bash use `/d/CCC`, not `D:\CCC` |
| `gh` / auth prompts | For clone over HTTPS, sign in when Git Credential Manager asks, or use SSH |

## 2. Install dependencies

```bash
cd /d/CCC
npm ci
```

## 3. Bring over credentials (not in Git)

Credentials live only in local files / Vercel / your password manager.

**Option A — copy from another machine that already has them**

Copy these into `D:\CCC\` (same relative paths):

- `.env.local`
- `secrets\` (optional backup folder)

Then in Git Bash:

```bash
cd /d/CCC
npm run secrets:restore   # if you copied secrets/ but not .env.local
npm run secrets:list      # names only — confirms Termii/Supabase keys are set
```

**Option B — pull from Vercel**

```bash
cd /d/CCC
npx vercel link            # project: ccc / kreation-vibe-studios-projects
npx vercel env pull .env.local --yes
npm run secrets:backup
```

**Option C — start from template**

```bash
cd /d/CCC
cp .env.example .env.local
# Edit .env.local and paste Supabase + Termii values
```

Minimum for SMS:

```env
TERMII_API_KEY=...
TERMII_SENDER_ID=HoR 2027
```

## 4. Run locally

With Docker (full stack including Supabase):

```bash
cd /d/CCC
npx supabase start
npm run pu:import
npm run dev
```

App only (using cloud Supabase URL in `.env.local`):

```bash
cd /d/CCC
npm run dev
```

Open http://localhost:3000

## 5. Quick check script

```bash
cd /d/CCC
bash scripts/windows-local-setup.sh
```

That confirms you are in `D:/CCC` (or `/d/CCC`) and prints next steps.
