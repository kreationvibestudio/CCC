# Expo EAS — CCC Agent APK (your PC)

Do this on **your computer**, not in the cloud agent. Expo login needs your browser.

The Agent app source is `apps/agent`. The EAS project is already linked:

- owner: `kreationvibestudio`
- project id: `4992c0a7-72be-4527-a41d-e23b730ee9ef`

## 1. Account

Open [https://expo.dev/signup](https://expo.dev/signup) and create/sign in.

## 2. Git Bash at `D:\CCC`

```bash
cd /d/CCC
git fetch origin
git checkout cursor/agent-mobile-apps-0aee
git pull origin cursor/agent-mobile-apps-0aee
```

## 3. Install the EAS command

```bash
npm install --global eas-cli
eas --version
```

## 4. Log in (the one step only you can do)

```bash
cd /d/CCC/apps/agent
eas login
eas whoami
```

Sign in in the browser that opens.

## 5. Anon key for sign-in inside the APK

From Supabase → **Project Settings → API → anon public**.

```bash
cd /d/CCC/apps/agent
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "PASTE_ANON_KEY_HERE"
```

## 6. Build

```bash
cd /d/CCC/apps/agent
eas build --platform android --profile preview
```

Say **yes** to creating a keystore the first time. Wait until the CLI prints a download URL.

## 7. Install on a phone

Download the `.apk` from that URL (or expo.dev → CCC Agent → Builds). Sideload it. Agents sign in with the HQ-issued email, not an Expo account.

If `eas login` or `eas build` errors, paste the full terminal output and we can fix the next step.
