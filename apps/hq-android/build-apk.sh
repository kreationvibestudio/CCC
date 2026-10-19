#!/usr/bin/env bash
# Build a signed CCC HQ TWA APK for sideload (Android 9+ / API 21+).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
APKS_DIR="$REPO/apks"
cd "$ROOT"

if [[ ! -f android-keys/ccc-hq-upload.keystore ]]; then
  echo "Missing android-keys/ccc-hq-upload.keystore"
  echo "Generate one (preview example):"
  echo "  keytool -genkeypair -v -keystore android-keys/ccc-hq-upload.keystore -alias ccc-hq -keyalg RSA -keysize 2048 -validity 10000"
  exit 1
fi
if [[ ! -f android-keys/keystore.properties ]]; then
  echo "Copy android-keys/keystore.properties.example → android-keys/keystore.properties and fill passwords."
  exit 1
fi

: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-}}"
if [[ -z "${ANDROID_HOME}" ]]; then
  echo "Set ANDROID_HOME to your Android SDK path."
  exit 1
fi
echo "sdk.dir=${ANDROID_HOME}" > local.properties

./gradlew assembleRelease
APK="$ROOT/app/build/outputs/apk/release/app-release.apk"
VERSION="$(sed -n 's/.*versionName "\([^"]*\)".*/\1/p' app/build.gradle | head -1)"
VERSION="${VERSION:-1.0.0}"
mkdir -p "$APKS_DIR"
OUT_HQ="$APKS_DIR/ccc-hq-v${VERSION}-android9.apk"
OUT_LATEST="$APKS_DIR/ccc-hq-latest.apk"
cp -f "$APK" "$OUT_HQ"
ln -sfn "$(basename "$OUT_HQ")" "$OUT_LATEST"

echo "Built: $APK"
echo "Copied into apks/:"
ls -la "$OUT_HQ" "$OUT_LATEST"
