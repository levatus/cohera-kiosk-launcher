/**
 * Config plugin that implements Android Lock Task Mode for the kiosk app.
 *
 * During `expo prebuild` this plugin:
 *  1. Writes LockTaskModule.kt and LockTaskPackage.kt into the Android source tree.
 *  2. Patches MainActivity.kt to call startLockTask() in onResume() so the
 *     device is pinned immediately on launch (requires Device Owner setup via ADB).
 *  3. Patches MainApplication.kt to register LockTaskPackage so JS can call
 *     NativeModules.LockTaskModule.startLock() / stopLock().
 */

const {
  withMainActivity,
  withMainApplication,
  withDangerousMod,
} = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const LOCK_TASK_MODULE_KT = (packageName) => `\
package ${packageName}

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LockTaskModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        /** Tracks whether kiosk lock is intentionally active.
         *  MainActivity.onResume() checks this before re-engaging startLockTask()
         *  so that a stopLock()-triggered resume cycle does not immediately
         *  re-lock the task. */
        var kioskEnabled = true
    }

    override fun getName(): String = "LockTaskModule"

    /**
     * If this app is the Device Owner, whitelist itself for lock-task mode.
     * This suppresses the Android "unpin" prompt entirely — the user cannot
     * exit via Back+Overview or any system gesture.
     */
    private fun whitelistSelf() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return
        try {
            val dpm = reactApplicationContext
                .getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(
                reactApplicationContext,
                KioskDeviceAdminReceiver::class.java
            )
            if (dpm.isDeviceOwnerApp(reactApplicationContext.packageName)) {
                dpm.setLockTaskPackages(admin, arrayOf(reactApplicationContext.packageName))
            }
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun startLock(promise: Promise) {
        kioskEnabled = true
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current Activity")
            return
        }
        try {
            whitelistSelf()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                activity.startLockTask()
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("START_LOCK_TASK_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stopLock(promise: Promise) {
        kioskEnabled = false
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current Activity")
            return
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                activity.stopLockTask()
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("STOP_LOCK_TASK_FAILED", e.message, e)
        }
    }

    /**
     * Silently install an APK using Android PackageInstaller.
     * Works without any user dialog because this app is the Device Owner.
     * The system will kill and restart the app once installation completes.
     *
     * @param apkUri  file:// URI returned by expo-file-system (e.g. cacheDirectory + "kiosk-update.apk")
     */
    @ReactMethod
    fun installApk(apkUri: String, promise: Promise) {
        try {
            val path = apkUri.removePrefix("file://")
            val apkFile = java.io.File(path)
            if (!apkFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "APK not found at: $path")
                return
            }

            val packageInstaller = reactApplicationContext.packageManager.packageInstaller
            val params = android.content.pm.PackageInstaller.SessionParams(
                android.content.pm.PackageInstaller.SessionParams.MODE_FULL_INSTALL
            )

            val sessionId = packageInstaller.createSession(params)
            val session = packageInstaller.openSession(sessionId)

            apkFile.inputStream().use { input ->
                session.openWrite("base.apk", 0, apkFile.length()).use { output ->
                    input.copyTo(output)
                    session.fsync(output)
                }
            }

            val intent = android.content.Intent("\${reactApplicationContext.packageName}.INSTALL_COMPLETE").apply {
                setPackage(reactApplicationContext.packageName)
            }
            val pendingIntent = android.app.PendingIntent.getBroadcast(
                reactApplicationContext,
                sessionId,
                intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

            session.commit(pendingIntent.intentSender)
            session.close()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("INSTALL_FAILED", e.message, e)
        }
    }
}
`;

const LOCK_TASK_PACKAGE_KT = (packageName) => `\
package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LockTaskPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> = listOf(LockTaskModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> = emptyList()
}
`;

function writeKotlinFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const packageName =
        config.android?.package ?? "com.clinic.kioskbrowser";
      const packagePath = packageName.replace(/\./g, "/");
      const javaDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java",
        packagePath
      );

      fs.mkdirSync(javaDir, { recursive: true });

      fs.writeFileSync(
        path.join(javaDir, "LockTaskModule.kt"),
        LOCK_TASK_MODULE_KT(packageName)
      );
      fs.writeFileSync(
        path.join(javaDir, "LockTaskPackage.kt"),
        LOCK_TASK_PACKAGE_KT(packageName)
      );

      return config;
    },
  ]);
}

function patchMainActivity(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Already patched with the guarded version — nothing to do.
    if (contents.includes("LockTaskModule.kioskEnabled")) return config;

    const guardedOnResumeBlock = `
  override fun onResume() {
    super.onResume()
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP && LockTaskModule.kioskEnabled) {
      try {
        val dpm = getSystemService(android.content.Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
        val admin = android.content.ComponentName(this, KioskDeviceAdminReceiver::class.java)
        if (dpm.isDeviceOwnerApp(packageName)) {
          dpm.setLockTaskPackages(admin, arrayOf(packageName))
        }
        startLockTask()
      } catch (e: Exception) { /* no-op if not device owner */ }
    }
  }`;

    // If the old unguarded block is already present, upgrade it in-place by
    // replacing the bare SDK version check with the kioskEnabled-guarded one.
    // This handles existing prebuilt android/ trees generated before this fix.
    if (contents.includes("startLockTask()")) {
      config.modResults.contents = contents.replace(
        /if \(android\.os\.Build\.VERSION\.SDK_INT >= android\.os\.Build\.VERSION_CODES\.LOLLIPOP\) \{/,
        "if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP && LockTaskModule.kioskEnabled) {"
      );
      return config;
    }

    // Fresh inject — no onResume block exists at all yet.
    const classBodyEnd = contents.lastIndexOf("}");
    if (classBodyEnd === -1) return config;

    config.modResults.contents =
      contents.slice(0, classBodyEnd) + guardedOnResumeBlock + "\n" + contents.slice(classBodyEnd);

    return config;
  });
}

function patchMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    const packageName =
      config.android?.package ?? "com.clinic.kioskbrowser";

    if (contents.includes("LockTaskPackage")) return config;

    // Add the import after the ReactApplication import
    contents = contents.replace(
      /import com\.facebook\.react\.ReactApplication/,
      `import com.facebook.react.ReactApplication\nimport ${packageName}.LockTaskPackage`
    );

    // Insert packages.add() AFTER "val packages = PackageList(this).packages"
    // so that `packages` is already declared when the add call runs.
    contents = contents.replace(
      /(val packages = PackageList\(this\)\.packages)/,
      `$1\n      packages.add(LockTaskPackage())`
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withLockTask(config) {
  config = writeKotlinFiles(config);
  config = patchMainActivity(config);
  config = patchMainApplication(config);
  return config;
};
