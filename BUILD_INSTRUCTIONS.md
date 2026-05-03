# Build Instructions — Kiosk Launcher APK

## Prerequisites (one-time, on your local machine)

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

---

## Build steps

### 1. Download the project code
Clone the standalone repository to your machine:
```bash
git clone https://github.com/levatus/cohera-kiosk-launcher.git
cd cohera-kiosk-launcher
```

Or click **Code → Download ZIP** on the GitHub page and unzip it.

### 2. Install dependencies
```bash
pnpm install
```

### 3. Log in to Expo
```bash
eas login
```
Enter your Expo account email and password when prompted.

### 4. Run the build
```bash
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

## Rebuilding in future

You only need to rebuild the APK if you change something baked in
(PIN, EMR URL, or a native kiosk feature). For those cases:

1. Update `eas.json` with the new values
2. Bump `versionCode` in `app.json` by 1
3. Run `eas build --platform android --profile production` again
4. Upload the new APK to your MDM — it will push to all tablets automatically

Regular changes to the EMR web app are reflected on tablets instantly
with no rebuild needed.
