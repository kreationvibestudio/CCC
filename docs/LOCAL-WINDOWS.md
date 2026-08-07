# Local Windows copy — `D:\CCC`

This repo’s **canonical local machine path** is:

```text
D:\CCC
```

Use **Git Bash** (not PowerShell) for the commands below.

## 1. Get the code onto `D:\CCC`

If the folder does not exist yet:

```bash
mkdir -p /d/CCC
cd /d/CCC
git clone https://github.com/kreationvibestudio/CCC.git .
```

If it already exists:

```bash
cd /d/CCC
git pull origin main
```

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
TERMII_SENDER_ID=Hor 2027
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
