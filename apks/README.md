# CCC Android APKs

Sideloadable builds. Copy a file to the phone and open it to install (allow “Install unknown apps” for your Files app if prompted).

| File | Package | Min Android | Who |
|------|---------|-------------|-----|
| `ccc-hq-v1.0.1-android9.apk` | `ng.ccc.hq` | **9+** (API 28+; also installs on 5.0+ / API 21) | HQ staff — full war room via Trusted Web Activity |
| `ccc-agent-v1.1.0-9deb920.apk` | `ng.ccc.agent` | **7+** (API 24+) | Field Agents — Expo native app (git `9deb920`) |
| `ccc-agent-latest.apk` | symlink → Agent APK above | | |

## CCC Agent (field)

1. Install `ccc-agent-v1.1.0-9deb920.apk` (or `ccc-agent-latest.apk`).
2. Open **CCC Agent** → sign in with the **HQ-issued agent code** at the polling unit.
3. GPS must be within **100 ft** of the unit pin. Soft GPS is lab-only.
4. Do **not** use HQ Super Admin emails in the Agent app.

Built from git ref `9deb920` (“Accept 10-character agent codes…”). Points at production `https://ccc-three-kappa.vercel.app`.

Direct download (after merge to `main`):

```
https://raw.githubusercontent.com/kreationvibestudio/CCC/main/apks/ccc-agent-v1.1.0-9deb920.apk
```

Until merge, use the branch raw URL from the PR.

## CCC HQ on Android 9

1. Install **Chrome** from Play Store (TWA / Custom Tabs needs it).
2. Install `ccc-hq-v1.0.1-android9.apk`.
3. Open **CCC HQ** → sign in with your HQ account at `https://ccc-three-kappa.vercel.app`.
4. Do **not** use the field **CCC Agent** app for HQ login.

Rebuild HQ:

```bash
cd apps/hq-android
export ANDROID_HOME=…   # Android SDK
./build-apk.sh          # writes into this folder
```

See [`docs/HQ-MOBILE.md`](../docs/HQ-MOBILE.md).
