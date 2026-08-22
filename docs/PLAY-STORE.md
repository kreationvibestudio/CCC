# Put CCC Agent on Google Play

The Expo app in `apps/agent` already has a **production** profile that builds an Android App Bundle (`.aab`), which Play requires. Preview APKs are for sideload only — they cannot be the Play Store file.

## 1. Google Play Console

1. Open [https://play.google.com/console](https://play.google.com/console).
2. Pay the one-time **$25** developer registration if the account is new (can take up to 48 hours to approve).
3. **Create app** → name **CCC Agent**, language English, app type **App**, category **Free**.
4. Package name must stay `ng.ccc.agent` (already set in `apps/agent/app.json`).

## 2. Store listing (while the AAB builds)

Play will not publish without:

- Short and full description
- App icon (512×512) — start from `apps/agent/assets/icon.png`
- Feature graphic 1024×500
- At least 2 phone screenshots
- Privacy policy URL (a public page on your campaign site)
- Content rating questionnaire
- Target audience / news-app declarations

Use an **internal testing** track first (already set in `apps/agent/eas.json` → `submit.production.android.track: internal`). Testers install from a Play link without a public listing.

## 3. Build the Play file (AAB)

On a machine logged into Expo (`eas whoami`):

```bash
cd apps/agent
eas build --platform android --profile production
```

This produces an `.aab`, not an `.apk`. Download it from the Expo build page.

## 4. Submit to Play

**Option A — EAS (after a Play service account JSON is in Expo):**

1. Play Console → Setup → API access → create a service account, grant **Release to production / internal**.
2. Download the JSON key.
3. `eas submit --platform android --profile production` and point at that JSON (or store it with `eas credentials`).

**Option B — Manual (fastest first time):**

1. Play Console → CCC Agent → **Internal testing** → Create release.
2. Upload the `.aab` from step 3.
3. Add testers (Gmail addresses) → send the Play opt-in link.

Production / Play Store listing comes after internal testers work. Promote the same release to **Closed**, then **Open**, then **Production**.

## 5. What field agents sign in with

Not Expo. Not your HQ Super Admin email.

HQ → **Polling units → PU Agents** → assign an email to a PU. That creates a **Field Agent** login. Only that role can use the CCC Agent app.
