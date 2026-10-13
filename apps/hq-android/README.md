# CCC HQ — Android TWA

Thin Trusted Web Activity for **Campaign Command Center HQ**.

- Application id: `ng.ccc.hq`
- Opens: `https://ccc-three-kappa.vercel.app/dashboard`
- Min SDK 21 (Android 5+), including **Android 9**
- Not the field app (`ng.ccc.agent`)
- Built APKs land in [`apks/`](../../apks/)

See [`docs/HQ-MOBILE.md`](../../docs/HQ-MOBILE.md) for install steps.

```bash
export ANDROID_HOME=…
cp android-keys/keystore.properties.example android-keys/keystore.properties
./build-apk.sh
```
