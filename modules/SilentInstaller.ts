/**
 * Thin wrapper around the native SilentInstallerModule.
 *
 * installApk(localFilePath)
 *   — Streams the APK at the given local path (or file:// URI) into a
 *     PackageInstaller session and commits it using the Device Owner context,
 *     triggering a completely silent installation with no Android dialog.
 *   — Rejects with code "NOT_DEVICE_OWNER" when the app is not the device
 *     owner, allowing callers to fall back to intent-launcher behavior.
 *   — No-op on platforms other than Android (resolves immediately).
 */

import { NativeModules, Platform } from "react-native";

interface SilentInstallerNativeModule {
  installApk: (filePath: string) => Promise<void>;
}

const { SilentInstallerModule } = NativeModules as {
  SilentInstallerModule: SilentInstallerNativeModule | undefined;
};

/**
 * Installs the APK at `localFilePath` silently using the Device Owner
 * PackageInstaller session API. Throws with code "NOT_DEVICE_OWNER" when
 * device owner privilege is unavailable so the caller can fall back.
 */
export async function installApk(localFilePath: string): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!SilentInstallerModule) {
    throw Object.assign(
      new Error("SilentInstallerModule not registered"),
      { code: "NOT_DEVICE_OWNER" }
    );
  }
  return SilentInstallerModule.installApk(localFilePath);
}
