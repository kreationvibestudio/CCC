# Facebook sync setup (reliable / always-on)

CCC syncs the **Hon Akhakon Annenih** page into Social + Comments.

**Without Meta tokens:** set `SOCIAL_DEMO_MODE=true` (default when tokens are empty). Click **Sync Facebook Now** to load campaign sample posts so Social Media and Comments stay usable.

**With live Facebook:** prefer a **never-expiring page token** stored in Vercel, plus optional App ID/Secret so short-lived user tokens can be refreshed automatically. Then set `SOCIAL_DEMO_MODE=false`.

Hard-coded page ID used in docs: `671649942702174`

---

## One-time: create a never-expiring page token

### 1. Graph API Explorer
https://developers.facebook.com/tools/explorer/

1. Select app **campaign commander center**
2. Add permissions:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_read_user_content`
   - `pages_manage_engagement` (for replies)
3. **Generate Access Token** → log in as a **page admin**

### 2. Make the user token long-lived (~60 days)

In a browser (replace placeholders):

```
https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_USER_TOKEN
```

Copy `access_token` from the JSON response.

### 3. Get the page token (does not expire)

```
https://graph.facebook.com/v21.0/me/accounts?access_token=LONG_LIVED_USER_TOKEN
```

Find page `671649942702174` and copy its `access_token`.

### 4. Set Vercel env (Production + Preview)

| Variable | Value |
|----------|--------|
| `FACEBOOK_PAGE_ID` | `671649942702174` |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | page token from step 3 |
| `FACEBOOK_USER_ACCESS_TOKEN` | long-lived user token from step 2 |
| `FACEBOOK_APP_ID` | Meta app ID (Settings → Basic) |
| `FACEBOOK_APP_SECRET` | Meta app secret |

Then redeploy.

> **Important:** Do not rely on `vercel env pull` for Facebook tokens. Sensitive values are redacted as `[SENSITIVE]` and will break local sync. Paste real tokens in the Vercel dashboard (and into `.env.local` manually for local dev).

---

## What CCC does automatically now

- Tries **env page token → stored DB token → user token exchange** until one works
- Retries transient Graph API failures
- Saves the working page token on `social_accounts` for the next sync
- Continues posting sync if some comments fail
- Hourly cron: `/api/cron/facebook-sync` (Vercel Cron)

---

## Permission error (`pages_read_engagement` / `#10`)

Regenerate the token with the permissions listed above, then update Vercel and redeploy.

---

## Still failing?

- You must be an **Admin** on the Facebook page
- In developers.facebook.com → app → **Roles**, add your Facebook user
- App in Development mode needs you as a tester/admin, or use Live mode with approved permissions
- Open **Admin → Secrets readiness** — Facebook page token should show as set
