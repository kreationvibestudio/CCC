# Termii SMS setup

Termii powers **Communications → Send** (batch SMS to CRM contacts).

## 1. Create credentials

1. Sign up at [termii.com](https://termii.com)
2. Copy the API key from the dashboard
3. Register / approve a sender ID (e.g. `CCC` or your campaign short name)

## 2. Local

Add to `.env.local` (never commit):

```
TERMII_API_KEY=your_key
TERMII_SENDER_ID=HoR 2027
```

Then:

```bash
npm run secrets:backup
npm run secrets:github   # optional remote vault
```

Restart `npm run dev`.

## 3. Production (Vercel)

1. Open [Vercel env vars for CCC](https://vercel.com/kreation-vibe-studios-projects/ccc/settings/environment-variables)
2. Set `TERMII_API_KEY` and `TERMII_SENDER_ID` for Production (+ Preview if needed)
3. Redeploy

Admin → **Secrets readiness** shows whether keys are present (not the values).

## 4. Smoke test

1. Log in as an admin / role with `communications.send`
2. Ensure CRM contacts have phone numbers
3. Communications → draft campaign → **Send** → pick SMS template
4. Or single SMS:

```bash
# Must be authenticated (browser session). Prefer the UI Send button.
curl -X POST http://localhost:3000/api/communications/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"2348012345678","message":"Test from CCC"}'
```

Without `TERMII_API_KEY`, the API returns **503** with a clear error (by design).
