# Termii SMS and WhatsApp setup

Termii powers **Communications → Send** (batch SMS to CRM contacts) and **Training Management → Send codes** (WhatsApp training codes).

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

## 5. WhatsApp training codes

WhatsApp Business only delivers the first outbound message through an **approved template**. Volunteer signup and HQ **Send codes** call Termii `POST /api/send/template` — not free-form SMS.

1. In Termii, register a WhatsApp device and copy the **Device ID**
2. Submit a template and wait for WhatsApp approval. Suggested body (placeholders must match Termii’s Device Subscription keys):

   `Hello {{name}}, your volunteer training code is {{code}}. Open {{url}} and sign in with this phone number plus the code.`

   If Termii shows numbered variables, use `TERMII_WHATSAPP_DATA_KEYS=1,2,3` (`1` = name, `2` = code, `3` = learn URL).
3. Set on **Vercel Production** (and `.env.local` for local tests):

```
TERMII_API_KEY=your_key
TERMII_WHATSAPP_DEVICE_ID=your_device_id
TERMII_WHATSAPP_TEMPLATE_ID=your_template_id
TERMII_WHATSAPP_DATA_KEYS=name,code,url
```

4. Redeploy. Admin → Secrets readiness shows whether the device ID and template ID are present (not the values).

If those WhatsApp values are missing, signup still succeeds and shows the code on screen. HQ **Send codes** can still email codes if email is configured.

## 6. Email training codes

Termii Email Product Notification sends templated mail (`POST /api/templates/send-email`). Create an email configuration and a template on the Termii dashboard with `{{name}}`, `{{code}}`, and `{{url}}` (or numbered keys).

Set on **Vercel Production**:

```
TERMII_API_KEY=your_key
TERMII_EMAIL_CONFIGURATION_ID=your_email_configuration_id
TERMII_EMAIL_TEMPLATE_ID=your_email_template_id
TERMII_EMAIL_SUBJECT=Your volunteer training code
TERMII_EMAIL_VARIABLE_KEYS=name,code,url
```

Email is optional on volunteer signup. If the volunteer left email blank, we skip email and still send WhatsApp when that channel is configured.

Public signup and HQ volunteer create send the code automatically after it is generated (WhatsApp and/or email). Training Management → **Send codes** resends to selected People-tab rows, or to all scoped volunteers when none are selected (capped at 200). HQ returns an error only when **neither** WhatsApp nor email is configured.
