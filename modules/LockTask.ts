/**
 * Thin wrapper around the LockTaskModule native Android module.
 *
 * startLock()   — pins the app (calls setLockTaskPackages + startLockTask).
 * stopLock()    — unpins the app.
 * installApk()  — silently installs an APK as Device Owner via PackageInstaller.
 *                 No dialog shown. The system restarts the app when done.
 *
 * All functions are no-ops on iOS and web.
 */

import { NativeModules, Platform } from "react-native";

interface LockTaskNativeModule {
  startLock: () => Promise<void>;
  stopLock: () => Promise<void>;
  installApk: (apkUri: string) => Promise<void>;
}

const { LockTaskModule } = NativeModules as {
  LockTaskModule: LockTaskNativeModule | undefined;
};

/**
 * True only when the running APK includes the native PackageInstaller method
 * (introduced in build 5). On older APKs the method exists on the TS type
 * but is absent from the native bridge — calling it would throw at runtime.
 */
export const hasNativeInstallApk =
  Platform.OS === "android" &&
  typeof (NativeModules.LockTaskModule as Record<string, unknown> | undefined)
    ?.installApk === "function";

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

/**
 * Silently install an APK without any user dialog.
 * Requires this app to be the Device Owner.
 * The system will kill and relaunch the app once installation completes.
 */
export async function installApk(apkUri: string): Promise<void> {
  if (Platform.OS !== "android" || !LockTaskModule) return;
  await LockTaskModule.installApk(apkUri);
}
