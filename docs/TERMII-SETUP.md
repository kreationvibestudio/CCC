# Termii SMS, WhatsApp, and email setup

Termii powers **Communications → Send** (batch SMS) and **Training Management → Send codes** (WhatsApp and/or email training codes).

You do **not** set up WhatsApp Cloud API yourself in Meta. Termii is the business solution provider. Do **not** add the campaign number in Meta WhatsApp Manager.

---

## What you actually need

| Goal | Required env vars | Skip these |
|------|-------------------|------------|
| SMS (Communications) | `TERMII_API_KEY`, `TERMII_SENDER_ID` | — |
| Email training codes | `TERMII_API_KEY`, `TERMII_EMAIL_CONFIGURATION_ID` | `TERMII_EMAIL_TEMPLATE_ID`, `TERMII_EMAIL_SUBJECT`, `TERMII_EMAIL_VARIABLE_KEYS` |
| WhatsApp training codes | `TERMII_API_KEY`, `TERMII_WHATSAPP_DEVICE_ID`, `TERMII_WHATSAPP_TEMPLATE_ID` | `TERMII_WHATSAPP_DATA_KEYS` unless Termii shows numbered variables |

`TERMII_EMAIL_SUBJECT` defaults to `Your volunteer training code`.  
`TERMII_EMAIL_VARIABLE_KEYS` and `TERMII_WHATSAPP_DATA_KEYS` default to `name,code,url`. Leave them unset.

Email Product Notification (`TERMII_EMAIL_TEMPLATE_ID`) is a **separate Termii product**. Most accounts never get a `template_id`. CCC falls back to **Email Token** (`POST /api/email/otp/send`) when only the configuration ID is set. The training code is the OTP in Termii’s approved email. The Learn login URL still appears on the public signup screen.

---

## 1. API key and sender ID

1. Sign in at [accounts.termii.com](https://accounts.termii.com)
2. Copy the API key from the dashboard (no quotes or spaces)
3. Register / approve a sender ID. Termii allows **3–11 letters or numbers and no spaces** (`HoR2027`, not `HoR 2027`)

Local `.env.local`:

```
TERMII_API_KEY=your_key
TERMII_SENDER_ID=HoR2027
```

Optional: `TERMII_CHANNEL=dnd` for the transactional route (must be enabled on the Termii account). Default is `generic`.

Then:

```
npm run secrets:backup
npm run secrets:github   # optional remote vault
```

Restart `npm run dev`.

### Production (Vercel)

1. Open [Vercel env vars for CCC](https://vercel.com/kreation-vibe-studios-projects/ccc/settings/environment-variables)
2. Set the keys for **Production**
3. Merge to `main` so Production redeploys (or `npx vercel deploy --prod --yes` if you must)

Admin → **Secrets readiness** shows whether keys are present (not the values). **Test Termii** confirms the key and wallet credit — it does not send an SMS.

If Communications shows `Termii rejected the API key (HTTP 401)`, the key in Vercel is missing, quoted, or revoked.

---

## 2. Email — get `TERMII_EMAIL_CONFIGURATION_ID`

This is the ID people cannot find because it lives under **TOKEN**, not under Email Product.

1. Sign in at [accounts.termii.com](https://accounts.termii.com)
2. Open **TOKEN** in the left nav
3. Click **Email Setup**
4. Fill:
   - Company / from name (example: campaign name)
   - Reply-to email
   - Company logo
5. Submit for Termii approval
6. After approval, copy the **email configuration ID** (UUID) from that same Email Setup page
7. Set on Vercel Production:

```
TERMII_API_KEY=your_key
TERMII_EMAIL_CONFIGURATION_ID=0a53c416-uocj-95af-ab3c306aellc
```

Leave `TERMII_EMAIL_TEMPLATE_ID` empty.

Termii docs: [Email Token](https://developers.termii.com/email-token)  
Setup walkthrough: [Email Token for businesses](https://blog.termii.com/termii-announces-its-email-token-service-for-businesses)

### Optional product template

Only if Termii enabled **Email Product Notification** and showed you a `template_id`:

```
TERMII_EMAIL_TEMPLATE_ID=your_template_id
# Optional overrides — only needed when placeholder names differ
# TERMII_EMAIL_SUBJECT=Your volunteer training code
# TERMII_EMAIL_VARIABLE_KEYS=name,code,url
```

That path uses `POST /api/templates/send-email` with `{{name}}`, `{{code}}`, and `{{url}}`. If you do not see that product in the dashboard, skip it.

Email is skipped when the volunteer left the address blank. Signup still succeeds and shows the code on screen.

---

## 3. WhatsApp — do this on Termii, not in Meta Cloud

Meta will reject or confuse the number if you try to attach it yourself in WhatsApp Manager / Cloud API. Termii registers the number as the BSP.

Official Termii guide: [How to set up high-volume WhatsApp](https://blog.termii.com/termii-how-to-set-up-high-volume-whatsapp)

### 3a. Device ID

1. Open [Termii Devices](https://accounts.termii.com/#/devices)
2. Apply for a device, or copy an approved **Device ID**
3. Test IDs last **7 days**. Skip this apply step if Termii already added a live ID for you.

### 3b. Go live (email Termii — this is the step people miss)

Email **whatsapp@termii.com** (or your Termii support group) with:

- Facebook / Meta **business name**
- Facebook **Page ID**
- **Phone number** to attach to WhatsApp
- Current Meta **verification status** (verified / pending / not started)

Then:

1. Complete **Meta Business verification** in Meta Business Manager → Settings → Security Centre (Termii cannot skip this)
2. Wait for Meta approval
3. Return to [Devices](https://accounts.termii.com/#/devices) and copy the live device details
4. Load the Termii wallet

### 3c. Approved template (required for first outbound message)

1. Devices → **Manage Device** → **Request Templates**
2. Wrap variables in `<% %>` as Termii shows in the sample (not `{{ }}` unless the form says so)
3. Suggested body (adjust to Termii’s variable syntax):

   `Hello <%name%>, your volunteer training code is <%code%>. Open <%url%> and sign in with this phone number plus the code.`

4. Wait until status is **approved**. Pending/rejected templates will not send.
5. Copy the **template ID** from the device / Device Subscription page
6. Set on Vercel Production:

```
TERMII_WHATSAPP_DEVICE_ID=your_device_id
TERMII_WHATSAPP_TEMPLATE_ID=your_template_id
```

If the approved template uses numbered placeholders (`1`, `2`, `3`), set `TERMII_WHATSAPP_DATA_KEYS=1,2,3` (`1` = name, `2` = code, `3` = learn URL). Otherwise leave it unset.

CCC sends `POST /api/send/template` — not free-form WhatsApp.

### Why Meta WhatsApp Manager keeps failing

| What you tried | Why it fails | What to do instead |
|----------------|--------------|--------------------|
| Add the number in Meta WhatsApp Manager / Cloud API | Termii, not your Meta app, owns the WABA | Stop. Email `whatsapp@termii.com` and finish Devices |
| Number still on personal WhatsApp | Meta will not migrate a number that is already registered | Delete WhatsApp on that SIM (Settings → Account → Delete account), wait, then retry via Termii |
| Business not verified | High-volume WhatsApp requires a verified Meta Business | Security Centre → Start verification; send Termii the status |
| Using a test Device ID after 7 days | Termii deactivates test IDs | Ask Termii for a live device after go-live |
| Sending without an approved template | First outbound message must be a template | Request Templates on the device; wait for **approved** |
| Putting the number on Facebook Page WhatsApp | That is Page inbox, not the Business API | Ignore Page WhatsApp for training codes |

Need more help: `whatsapp@termii.com`.

---

## 4. SMS smoke test

1. Log in as a role with `communications.send`
2. CRM contacts need Nigerian numbers (`0803…` or `234803…`)
3. Communications → draft campaign → **Send** → SMS template

Without a usable `TERMII_API_KEY` / sender ID, the API returns **503** with Termii’s reason.

---

## 5. Training-code delivery

Public signup and HQ volunteer create send the code automatically after it is generated (WhatsApp and/or email). Training Management → **Send codes** resends to selected People-tab rows, or to all scoped volunteers when none are selected (capped at 200). HQ returns an error only when **neither** WhatsApp nor email is configured.

If WhatsApp env is missing, signup still succeeds and shows the code on screen. Email Token still works with only `TERMII_EMAIL_CONFIGURATION_ID`.
