# Campaign Command Center (CCC)

AI-powered political campaign management for Nigerian elections.

## Quick Start (for beginners)

### Step 1 — Install and start

```bash
npm install
npm run dev
```

Open **http://localhost:3000**

### Step 2 — Facebook is already configured

Your Facebook page **Hon Akhakon Annenih** is set up in `.env.local`. No action needed.

### Step 3 — Log in and sync

1. Go to **http://localhost:3000/login**
2. Sign in (or register a new account)
3. Open **Social Media** in the left menu
4. Click **Sync Facebook Now**
5. Your posts will appear on the page

### Step 4 — View comments (optional extra permission)

Comments need one extra Facebook permission. To enable:

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Open your app → **Graph API Explorer**
3. Add permission: `pages_read_user_content`
4. Generate a new token and update `FACEBOOK_USER_ACCESS_TOKEN` in `.env.local`
5. Restart the app (`npm run dev`) and sync again

---

## Database (optional — for full features)

If you have Docker installed:

```bash
npx supabase start
npx supabase db reset
```

Then copy the anon key from `supabase start` output into `.env.local`.

Demo login after seed: `admin@demo.campaign.ng` / `DemoPassword123!`

---

## Facebook environment variables

| Variable | Description |
|----------|-------------|
| `FACEBOOK_PAGE_ID` | Your page ID (671649942702174) |
| `FACEBOOK_USER_ACCESS_TOKEN` | Token from Meta Graph API Explorer |

The app automatically converts your user token into a page token — you don't need to do this manually.

---

## Tech Stack

Next.js 15 · TypeScript · Supabase · Tailwind · Meta Graph API
