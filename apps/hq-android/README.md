# CCC HQ — Android TWA

Thin Trusted Web Activity for **Campaign Command Center HQ**.

- Application id: `ng.ccc.hq`
- Opens: `https://ccc-three-kappa.vercel.app/dashboard`
- Not the field app (`ng.ccc.agent`)

See [`docs/HQ-MOBILE.md`](../../docs/HQ-MOBILE.md) for Fold install steps.

```bash
export ANDROID_HOME=…
cp android-keys/keystore.properties.example android-keys/keystore.properties
./build-apk.sh
```
