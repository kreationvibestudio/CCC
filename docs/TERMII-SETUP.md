# Termii SMS setup

Termii powers **Communications → Send** (batch SMS to CRM contacts).

## 1. Create credentials

1. Sign up at [termii.com](https://termii.com)
2. Copy the API key from the dashboard (no quotes or spaces)
3. Register / approve a sender ID. Termii allows **3–11 letters or numbers and no spaces**
   (example: `HoR2027`, not `HoR 2027`)

## 2. Local

Add to `.env.local` (never commit):

```
TERMII_API_KEY=your_key
TERMII_SENDER_ID=HoR2027
```

Optional: `TERMII_CHANNEL=dnd` to use the transactional route (must be enabled on the Termii account). Default is `generic` (promotional; will not deliver to DND numbers).

Then:

```
npm run secrets:backup
npm run secrets:github   # optional remote vault
```

Restart `npm run dev`.

## 3. Production (Vercel)

1. Open [Vercel env vars for CCC](https://vercel.com/kreation-vibe-studios-projects/ccc/settings/environment-variables)
2. Set `TERMII_API_KEY` and `TERMII_SENDER_ID` for Production (+ Preview if needed)
3. Redeploy

Admin → **Secrets readiness** shows whether keys are present (not the values). Use **Test Termii** there to confirm the key is accepted and the wallet has credit — it does not send an SMS.

If Communications shows `Termii rejected the API key (HTTP 401)`, the key in Vercel is missing, quoted, or revoked. Paste the live dashboard key and redeploy.

## 4. Smoke test

1. Log in as an admin / role with `communications.send`
2. Ensure CRM contacts have Nigerian phone numbers (`0803…` or `234803…`)
3. Communications → draft campaign → **Send** → pick SMS template
4. Or single SMS:

```bash
# Must be authenticated (browser session). Prefer the UI Send button.
curl -X POST http://localhost:3000/api/communications/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"2348012345678","message":"Test from CCC"}'
```

Without a usable `TERMII_API_KEY` / sender ID, the API returns **503** with Termii’s reason.
