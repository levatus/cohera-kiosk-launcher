# Build Instructions — Kiosk Launcher APK

> **AGENT NOTE: Never run `eas build` unless the user explicitly asks for a new build in this conversation turn. Pushing code changes, editing `app.json`, or updating any kiosk file does NOT require triggering a build. EAS builds consume paid Expo build minutes and must only be initiated on direct user request.**

## Recommended: GitHub Actions (cloud build — no local toolchain needed)

This is the easiest way to build the APK. Everything runs in the cloud — no need to install anything on your machine.

### One-time setup

1. **Create an Expo access token**
   - Go to [expo.dev](https://expo.dev) and sign in
   - Navigate to **Account Settings → Access Tokens** (URL: `https://expo.dev/accounts/[your-account]/settings/access-tokens`)
   - Click **Create Token**, give it a name (e.g. `github-actions`), and copy the token value

2. **Add the token as a GitHub secret**
   - In your GitHub repository, go to **Settings → Secrets and variables → Actions**
   - Click **New repository secret**
   - Name: `EXPO_TOKEN`
   - Value: paste the token you copied above
   - Click **Add secret**

That's the only manual step — you only need to do this once.

---

### Triggering a build

1. Go to your GitHub repository → **Actions** tab
2. Select **Build Kiosk APK** from the left sidebar
3. Click **Run workflow** → **Run workflow**
4. Wait approximately 10–15 minutes for the build to complete
5. When the workflow finishes, open the completed run and expand the **Print build link** step
6. Follow the link to the Expo dashboard to download the APK

---

## Alternative: Local build

If you prefer to build on your own machine:

### Prerequisites (one-time)

1. **Node.js** — download from https://nodejs.org (LTS version)
2. **pnpm** — open a terminal and run:
   ```
   npm install -g pnpm
   ```
3. **EAS CLI** — open a terminal and run:
   ```
   npm install -g eas-cli
   ```
4. **Expo account** — sign up free at https://expo.dev

### Build steps

```bash
# 1. Install dependencies (from the repo root)
pnpm install

# 2. Log in to Expo
eas login

# 3. Run the build (from the kiosk-launcher directory)
cd artifacts/kiosk-launcher
eas build --platform android --profile production
```

- EAS will ask to link the project to your Expo account — say **yes**
- The build runs in Expo's cloud (10–15 minutes)
- When complete, you'll receive a **download link** for the APK file

---

## What's baked into this build

| Setting | Value |
|---|---|
| EMR URL | https://health-record-hub-slinuw.replit.app/kiosk |
| Admin PIN | (configured — keep this private) |
| Package name | com.clinic.kioskbrowser |
| Orientation | Portrait only |
| Daily refresh | 7:00 AM |

---

## Enabling OS-level lockdown (Device Owner — one-time ADB setup)

After installing the APK on a fresh tablet, run the following command **once** from a computer connected via USB:

```bash
adb shell dpm set-device-owner com.clinic.kioskbrowser/.KioskDeviceAdminReceiver
```

**Important prerequisites before running this command:**
- The tablet must have **no Google accounts** signed in. Go to Settings → Accounts and remove all accounts first.
- USB debugging must be enabled (Settings → Developer options → USB debugging).
- The kiosk APK must already be installed on the tablet.

Once Device Owner is set, the app will automatically enter true lock-task mode on every launch — the home button, back button, recents, and USB debugging are all disabled at the OS level. The existing escape hatch (5-second long press + PIN) still exits lock-task mode normally.

> **Note:** Device Owner status persists across app updates and reboots. It only needs to be set once per tablet. To remove it, you must factory reset the device.

---

## Uploading to your MDM

Once you have the APK file:

1. Log in to your MDM dashboard (Scalefusion, Intune, etc.)
2. Go to **Apps** → **Add App** → **Enterprise/In-house APK**
3. Upload the APK file
4. Assign it to your tablet group
5. When enrolling tablets, set kiosk policy to package: `com.clinic.kioskbrowser`

The MDM will push the app silently to all enrolled tablets.

---

## When to rebuild

> **AGENT NOTE: This section describes when *the user* should manually trigger a build. It is not a checklist for the agent. Do not run `eas build` as a side effect of any code change — only if the user explicitly requests it.**

You only need to rebuild the APK if you change something baked in at build time (PIN, EMR URL, or a native kiosk feature). When that happens, **you** (the user) should:

1. Update `eas.json` with the new values
2. Bump `versionCode` in `app.json` by 1
3. Trigger a new build yourself — either via the GitHub Actions workflow (see above) or by running `eas build --platform android --profile production` locally
4. Upload the new APK to your MDM — it will push to all tablets automatically

Regular changes to the EMR web app are reflected on tablets instantly
with no rebuild needed.
