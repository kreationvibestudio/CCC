#!/usr/bin/env bash
# Build a signed CCC HQ TWA APK for sideload on Android (Samsung Fold, etc.).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
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
echo "Built: $APK"
ls -la "$APK"
