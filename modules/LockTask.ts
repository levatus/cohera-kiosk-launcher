import { NativeModules, Platform } from "react-native";

interface LockTaskNativeModule {
  startLock: () => Promise<void>;
  stopLock: () => Promise<void>;
  closeApp: () => Promise<void>;
}

const { LockTaskModule } = NativeModules as {
  LockTaskModule: LockTaskNativeModule | undefined;
};

export async function startLock(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!LockTaskModule) throw new Error("LockTaskModule not registered");
  await LockTaskModule.startLock();
}

export async function stopLock(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!LockTaskModule) throw new Error("LockTaskModule not registered");
  await LockTaskModule.stopLock();
}

/**
 * Stops lock task mode and terminates the app process cleanly.
 * Calls the native closeApp() which runs stopLockTask() then
 * finishAndRemoveTask() + process kill — fully exits the app on all
 * Android API levels, including ≤ R where BackHandler.exitApp() only
 * moves the task to background.
 *
 * No-op on non-Android platforms.
 */
export async function closeApp(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!LockTaskModule) throw new Error("LockTaskModule not registered");
  await LockTaskModule.closeApp();
}
