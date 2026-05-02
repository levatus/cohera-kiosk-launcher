# Kiosk Launcher — Android WebView Kiosk App

A dedicated Android APK that wraps the Integrative EMR in a full-screen WebView with autoplay unrestricted, screen always-on, and programmatic lock task support. Replaces Chrome on room tablets so ambient and session audio plays automatically with no tap required.

## Configuration

Set both variables at build time (or in a `.env.local` file for local development).

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_EMR_URL` | production domain | The EMR URL loaded in the WebView |
| `EXPO_PUBLIC_KIOSK_EXIT_PIN` | `1234` | PIN staff must enter to access admin options — **change before deploying** |

```
EXPO_PUBLIC_EMR_URL=https://your-emr-domain.replit.app
EXPO_PUBLIC_KIOSK_EXIT_PIN=9876
```

---

## Building the APK

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli`
- An Expo account: `eas login`

### Build command

```bash
cd artifacts/kiosk-launcher
eas build --platform android --profile production
```

EAS Build runs in the cloud and emails you a download link when the APK is ready. No local Android SDK required.

---

## Sideloading the APK onto a Tablet

### Via ADB (USB cable)

1. Enable **Developer Options** on the tablet: Settings → About tablet → tap *Build number* 7 times.
2. Enable **USB debugging** in Developer Options.
3. Connect the tablet via USB.
4. Run:

```bash
adb install -r kiosk-launcher.apk
```

### Via direct download (no cable)

1. Download the APK link from EAS to the tablet's browser.
2. When prompted, allow *Install from unknown sources* for that browser.
3. Tap the downloaded file and follow the prompts.

---

## Lock Task Mode (Programmatic Kiosk — Recommended)

The app includes a native Android `LockTaskModule` (written to the Android source tree during `expo prebuild`). On launch, the app automatically calls `Activity.startLockTask()`, which pins the app and disables the Back and Home buttons at the OS level — no manual Screen Pinning step needed.

**Requirement:** The app must be declared as the Android **Device Owner** before lock task calls take effect. Without Device Owner status, `startLockTask()` is called but silently ignored by the OS (no crash, no error).

### Setting up Device Owner (one-time per tablet)

Lock task mode activates when the app is whitelisted for lock task by a Device Owner or Mobile Device Management (MDM) profile. The most straightforward way to whitelist the app without an MDM is via an Android Enterprise Device Owner shell command:

```bash
# Whitelist the app for lock task mode using an existing Device Owner/MDM
adb shell dpm set-lock-task-packages-for-user 0 com.clinic.kioskbrowser
```

If your organization uses an MDM (e.g., Microsoft Intune, Jamf), configure Kiosk/Single App Mode to target `com.clinic.kioskbrowser` in the MDM console. Once whitelisted, no ADB access is needed.

> **Note:** A full self-hosted Device Owner setup (where this app itself is the Device Policy Controller) requires a `DeviceAdminReceiver` component, which is not included in this release. See follow-up task for adding that capability.

Once whitelisted, the app pins itself on every launch automatically.

### Staff escape hatch & admin menu

Hold the small dot in the **bottom-right corner** of the screen for **5 seconds**. A growing ring animation provides feedback. After 5 seconds, a **PIN entry dialog** appears. Enter the correct staff PIN (set via `EXPO_PUBLIC_KIOSK_EXIT_PIN` at build time, default `1234`). An incorrect PIN can be retried up to 5 times before the dialog closes.

After a correct PIN, an **Admin Options** menu is shown with two choices:

- **Screen Schedule** — set daily on/off times (see below)
- **Exit Kiosk Mode** — calls `Activity.stopLockTask()` and unpins the app

---

## Screen Schedule

The kiosk can automatically turn the display on and off at set times each day — useful for turning off tablets overnight or during off-hours.

### Configuring the schedule

1. Hold the escape dot for 5 seconds → enter the admin PIN.
2. Tap **Screen Schedule** in the admin menu.
3. Under **Display hours**, toggle the schedule on and set **Screen ON** and **Screen OFF** times.
4. Under **Daily page refresh**, toggle it on and set the refresh time (default 07:00).
5. Tap **Save**.

The schedule is stored on the device and persists across restarts.

### Daily hard refresh

When the daily refresh is enabled, the WebView is reloaded once per day at the configured time (default 7:00 AM) — ensuring the kiosk always picks up the latest version of the EMR app without manual intervention. The app records the refresh date so it fires exactly once per calendar day.

### How screen off works

The app checks the schedule every 30 seconds (the CPU stays awake via `useKeepAwake`).

| Scenario | Screen OFF behaviour | Screen ON behaviour |
|---|---|---|
| Device Owner configured | `DevicePolicyManager.lockNow()` — true display off | Wake lock with `ACQUIRE_CAUSES_WAKEUP` |
| No Device Owner | Full-screen black overlay (JS fallback) | Overlay removed |

The JS fallback achieves the visual effect without Device Admin rights, though it does not reduce backlight power on LCD screens.

---

## Screen Pinning (Alternative — No ADB Required)

If Device Owner setup via ADB is not feasible, Android's built-in Screen Pinning achieves a similar result with a manual setup step per tablet session.

1. Open **Settings → Security → Screen Pinning** (search "pin" in Settings if needed).
2. Toggle **Screen Pinning** on.
3. Open the Kiosk Launcher app.
4. Press the **Recents** (square) button.
5. Tap the app icon at the top of the Kiosk Launcher card → **Pin**.

### Unpinning via Screen Pinning

Hold **Back + Recents** simultaneously for ~2 seconds. Android prompts for your PIN before unpinning.

> Note: When using Screen Pinning (not Device Owner), the 5-second long-press calls `stopLockTask()` which will have no effect — use the Back+Recents gesture instead.

---

## Setting the App as the Default Home Launcher

When Kiosk Launcher is set as the default launcher the tablet boots directly into the EMR — no lock screen interaction or app selection needed.

1. Go to **Settings → Apps → Default apps → Home app**.
2. Select **Kiosk Launcher**.

To revert, repeat the steps and choose a different launcher.

### Auto-start on reboot

Once set as the default launcher, the app opens automatically whenever the tablet restarts. Combined with Device Owner lock task mode, the tablet is fully locked to the EMR from boot.

---

## Features

| Feature | Status |
|---|---|
| Full-screen WebView (no browser chrome) | ✅ |
| Media autoplay without tap (`mediaPlaybackRequiresUserGesture=false`) | ✅ |
| Screen always-on (`expo-keep-awake`) | ✅ |
| Status bar hidden | ✅ |
| Navigation bar hidden (immersive mode) | ✅ |
| Back button navigates within WebView history | ✅ |
| Programmatic lock task on launch via native `LockTaskModule` | ✅ (requires Device Owner) |
| 5-second long-press → PIN → admin menu | ✅ |
| Exit kiosk from admin menu calls `stopLockTask()` | ✅ (requires Device Owner) |
| Daily screen on/off schedule with configurable times | ✅ |
| Daily hard refresh at configurable time (default 7 AM) | ✅ |
| Schedule persisted to device storage (survives restarts) | ✅ |
| Home launcher intent filter (auto-start on reboot) | ✅ |
| Android Screen Pinning support (no-ADB alternative) | ✅ via Android Settings |
| Portrait orientation lock | ✅ |
| Android `singleTask` launch mode | ✅ |

---

## Package Information

- **Package name:** `com.clinic.kioskbrowser`
- **Platform:** Android only
- **Min Android version:** API 21 (Android 5.0 Lollipop — lock task requires API 21+)
