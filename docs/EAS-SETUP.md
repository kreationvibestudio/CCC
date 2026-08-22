# Expo EAS — CCC Agent APK

The Agent app is in `apps/agent`. EAS project is already linked:

- owner: `kreationvibestudios`
- project id: `4992c0a7-72be-4527-a41d-e23b730ee9ef`

`eas login` opens a **localhost** page. That only works if the terminal and the browser are on the **same computer**. It fails in Cursor Cloud (`localhost refused to connect`).

Pick **A** (this Cursor terminal) or **B** (your Windows PC).

---

## A) Cursor Cloud terminal (this chat)

### 1. Create an Expo access token in a normal browser

On your laptop, open **https://expo.dev** (not localhost). Sign in. Then:

[https://expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)

Click **Create token**, copy it.

### 2. Paste the token in the Cursor terminal

```bash
cd /workspace/apps/agent
export EXPO_TOKEN="paste-the-token-here"
eas whoami
```

You should see your Expo username. Do not commit the token. Do not paste it into git.

### 3. Store the Supabase anon key

Supabase → Project Settings → API → **anon public**:

```bash
cd /workspace/apps/agent
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "PASTE_ANON_KEY_HERE"
```

### 4. Build the APK

```bash
cd /workspace/apps/agent
eas build --platform android --profile preview
```

First time: say **yes** to generating an Android keystore. When it finishes, the terminal prints a download URL.

---

## B) Your Windows PC (Git Bash at D:\CCC)

Here `eas login` **can** use the browser, because localhost is your own machine.

```bash
cd /d/CCC
git fetch origin
git checkout cursor/agent-mobile-apps-0aee
git pull origin cursor/agent-mobile-apps-0aee

npm install --global eas-cli
cd /d/CCC/apps/agent
eas login
eas whoami

eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "PASTE_ANON_KEY_HERE"
eas build --platform android --profile preview
```

---

## If you see “localhost refused to connect”

You ran `eas login` in the **cloud** terminal, and the browser ran on **your laptop**. Use **section A** (`EXPO_TOKEN`) or `eas login --no-browser` and type your Expo username/password in that same terminal.

## Install the APK

Download the `.apk` from the build URL (or expo.dev → CCC Agent → Builds). Sideload on Android. Agents sign in with the HQ-issued email, not Expo.
