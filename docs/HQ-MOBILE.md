# CCC HQ on mobile (Samsung Fold & Android)

Full Campaign Command Center HQ (Admin, Agents, Situation Room, Comments, Events, …) stays the **web product**. This pack makes it feel like a native app on a Fold 6 — without putting HQ into the field **CCC Agent** Expo app.

| App | Package | Who | What |
|-----|---------|-----|------|
| **CCC HQ** | `ng.ccc.hq` | HQ staff (Super Admin, directors, …) | Entire war room via PWA / TWA |
| **CCC Agent** | `ng.ccc.agent` | Field Agents only | Code + GPS at the polling unit |

Do **not** install CCC Agent for HQ login. HQ emails are rejected there on purpose.

---

## Option A — Install from Chrome (PWA)

Works as soon as production has the PWA bits (`manifest`, icons, service worker).

1. On the Fold, open **Chrome** (not Samsung Internet if Install is missing).
2. Go to `https://ccc-three-kappa.vercel.app/login` and sign in once if you like.
3. Chrome menu (⋮) → **Install app** / **Add to Home screen**.
4. Open **CCC HQ** from the home screen — standalone, no URL bar.
5. Prefer the **unfolded** inner screen for Situation Room, maps, and wide tables. Cover screen uses the existing drawer nav.

---

## Option B — Sideload the CCC HQ APK (TWA)

Trusted Web Activity wraps the same production URL in an Android package.

### Build (developer machine or Cursor Cloud with Android SDK)

```bash
cd apps/hq-android
cp android-keys/keystore.properties.example android-keys/keystore.properties
# Generate a keystore if you do not have one (preview example):
# keytool -genkeypair -v -keystore android-keys/ccc-hq-upload.keystore \
#   -alias ccc-hq -keyalg RSA -keysize 2048 -validity 10000
export ANDROID_HOME=/path/to/Android/Sdk
./build-apk.sh
```

Output: `apps/hq-android/app/build/outputs/apk/release/app-release.apk`

### Install on Fold 6

1. Copy the APK to the phone (Drive, USB, Nearby Share).
2. Open the file → Install (allow “Install unknown apps” for your Files app if prompted).
3. Launch **CCC HQ** → Chrome Custom Tabs / TWA opens HQ → sign in with your HQ account.

### Digital Asset Links

Production must serve:

`https://ccc-three-kappa.vercel.app/.well-known/assetlinks.json`

with package `ng.ccc.hq` and the **SHA-256** of the APK signing cert. The Next route lives at [`src/app/.well-known/assetlinks.json/route.ts`](../src/app/.well-known/assetlinks.json/route.ts). After rotating the keystore, update that fingerprint or the TWA falls back to a Custom Tab (still usable, with a thin browser chrome).

---

## Fold tips

- **Cover (~narrow):** drawer sidebar, scroll main content; registration forms stack to one column.
- **Unfolded:** use for Situation Room, polling maps, and Admin tables.
- Safe-area padding is applied so the punch-hole / hinge edge does not clip the header.

---

## Related

- Field Agent APK / Play: [`docs/EAS-SETUP.md`](EAS-SETUP.md), [`docs/PLAY-STORE.md`](PLAY-STORE.md)
- HQ Android project: [`apps/hq-android`](../apps/hq-android)
