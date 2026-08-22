# CCC Agent app (Android first, iOS later)

Expo (React Native) field app for polling agents. HQ stays on the web. This app talks to the existing CCC API at `/api/agent/*` with a Supabase user JWT. It never downloads the full polling-unit catalog.

## What it does

- Sign in with the HQ-issued agent email (non-agent accounts are rejected)
- Bottom tabs: Unit, Status, Report, Results, Incident
- Assigned PU shortcuts, GPS nearest (bounded), PU-code search
- Status, field report, result votes (featured + other INEC parties), incident
- Camera for result-sheet and incident photos, with preview
- SQLite offline queue (including photos copied into app storage) that flushes on reconnect
- Lagos live clock on submit; UTC `captured_at` on the server
- Expo push token registration; HQ can tap **Nudge app** on Polling agents

## Configure

Copy `.env.example` to `.env` in this folder:

```
EXPO_PUBLIC_API_URL=https://ccc-three-kappa.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use the **anon** key only. Never put the service role in the app.

Apply `supabase/migrations/20260822000000_agent_device_tokens.sql` on Supabase so push tokens persist.

## Run locally

From `apps/agent`:

```bash
npm install
npx expo start
```

Scan the QR with Expo Go (Android). GPS and camera are limited in Expo Go; a development or preview build is better for field tests.

## Android APK

EAS project `4992c0a7-72be-4527-a41d-e23b730ee9ef` is already linked.

**Cursor Cloud** (`localhost refused to connect` is expected here). On your laptop open [https://expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens), create a token, then in this terminal:

```bash
cd /workspace/apps/agent
export EXPO_TOKEN="paste-the-token-here"
eas whoami
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "PASTE_ANON_KEY_HERE"
eas build --platform android --profile preview
```

**Windows Git Bash at D:\CCC:** see [docs/EAS-SETUP.md](../../docs/EAS-SETUP.md) section B. There `eas login` can use the browser.

`preview` = APK for testers. `production` = `.aab` for Play Console.

## iOS / TestFlight (same project)

You need an Apple Developer account. Then:

1. Replace `submit.production.ios.ascAppId` in `eas.json` with the App Store Connect app id.
2. `eas build --platform ios --profile preview` then TestFlight via `eas submit --platform ios`.
3. Confirm camera and location permission copy in `app.json` → `ios.infoPlist`.

There is no second codebase. Android and iOS share `App.tsx`.

## API contract

All routes require `Authorization: Bearer <supabase access_token>` and `agent.portal`.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/agent/session` | Whoami, workspace, result-sheet parties |
| GET | `/api/agent/assigned-pus` | Assigned units (max 40) |
| GET | `/api/agent/nearest-pus?lat=&lng=` | Nearest (max 8) |
| GET | `/api/agent/search-pus?q=` | PU code search (max 25) |
| POST | `/api/agent/status` | PU status / turnout |
| POST | `/api/agent/reports` | Field report |
| POST | `/api/agent/results` | Party votes + optional `result_sheet_url` |
| POST | `/api/agent/incidents` | Incident + optional `media_url` |
| POST | `/api/agent/media` | Multipart photo → `election-media` |
| POST | `/api/agent/push-token` | Register Expo push token |
| POST | `/api/agent/nudge` | HQ: push one agent (`user_id`) |
