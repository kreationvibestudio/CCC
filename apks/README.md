# CCC Android APKs

Sideloadable builds for HQ (and future Agent drops). Copy a file to the phone and open it to install (allow “Install unknown apps” for your Files app if prompted).

| File | Package | Min Android | Who |
|------|---------|-------------|-----|
| `ccc-hq-v1.0.1-android9.apk` | `ng.ccc.hq` | **9+** (API 28+; also installs on 5.0+ / API 21) | HQ staff — full war room via Trusted Web Activity |
| *(Agent APKs, when added)* | `ng.ccc.agent` | see Agent docs | Field Agents only |

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
