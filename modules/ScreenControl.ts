/**
 * Thin wrapper around the native ScreenControlModule.
 *
 * wakeScreen()        — turns the display on (wake lock / setTurnScreenOn)
 * lockScreen()        — turns the display off (DevicePolicyManager.lockNow)
 *                       Resolves on success; rejects with code "NOT_DEVICE_ADMIN"
 *                       if the app does not have Device Owner / Admin rights.
 * setKeepScreenOn()   — sets/clears FLAG_KEEP_SCREEN_ON on the Activity window
 *                       so Android cannot dim or sleep the display while the app
 *                       is in the foreground.
 * hideSystemUI()      — enters sticky immersive mode: hides status bar and
 *                       navigation bar so the screen appears completely black.
 * showSystemUI()      — restores the status bar and navigation bar.
 *
 * All are no-ops on platforms other than Android.
 */

import { NativeModules, Platform } from "react-native";

const { ScreenControlModule } = NativeModules;

export async function wakeScreen(): Promise<void> {
  if (Platform.OS !== "android" || !ScreenControlModule) return;
  return ScreenControlModule.wakeScreen();
}

/**
 * Attempts to lock the screen via DevicePolicyManager.
 * Throws with code "NOT_DEVICE_ADMIN" if not device admin.
 */
export async function lockScreen(): Promise<void> {
  if (Platform.OS !== "android" || !ScreenControlModule) return;
  return ScreenControlModule.lockScreen();
}

/**
 * Sets or clears the Android FLAG_KEEP_SCREEN_ON window flag on the current
 * Activity. When enabled, Android cannot turn the display off while the app
 * is foregrounded, regardless of device battery or display-timeout settings.
 * No-op on non-Android platforms.
 */
export async function setKeepScreenOn(enabled: boolean): Promise<void> {
  if (Platform.OS !== "android" || !ScreenControlModule) return;
  return ScreenControlModule.setKeepScreenOn(enabled);
}

/**
 * Enters sticky immersive mode — hides both the status bar and the Android
 * navigation bar so the black screen-off overlay is truly fullscreen.
 * No-op on non-Android platforms.
 */
export async function hideSystemUI(): Promise<void> {
  if (Platform.OS !== "android" || !ScreenControlModule) return;
  return ScreenControlModule.hideSystemUI();
}

/**
 * Restores the status bar and navigation bar after hideSystemUI().
 * No-op on non-Android platforms.
 */
export async function showSystemUI(): Promise<void> {
  if (Platform.OS !== "android" || !ScreenControlModule) return;
  return ScreenControlModule.showSystemUI();
}
