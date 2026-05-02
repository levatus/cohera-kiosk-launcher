/**
 * Thin wrapper around the LockTaskModule native Android module.
 *
 * startLock() calls Activity.startLockTask() — pins the app so Back and Home
 * are disabled. Requires the app to be set as Device Owner (or to be on the
 * lock task whitelist) via ADB. If the device is not a Device Owner the OS
 * will silently ignore the call (no crash).
 *
 * stopLock() calls Activity.stopLockTask() — unpins the app.
 *
 * Both functions are no-ops on iOS and on web.
 */

import { NativeModules, Platform } from "react-native";

interface LockTaskNativeModule {
  startLock: () => Promise<void>;
  stopLock: () => Promise<void>;
}

const { LockTaskModule } = NativeModules as {
  LockTaskModule: LockTaskNativeModule | undefined;
};

export async function startLock(): Promise<void> {
  if (Platform.OS !== "android" || !LockTaskModule) return;
  try {
    await LockTaskModule.startLock();
  } catch {
    // Device Owner not set — silently ignored
  }
}

export async function stopLock(): Promise<void> {
  if (Platform.OS !== "android" || !LockTaskModule) return;
  try {
    await LockTaskModule.stopLock();
  } catch {
    // Not in lock task mode — silently ignored
  }
}
