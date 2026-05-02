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

import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LockTaskModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LockTaskModule"

    @ReactMethod
    fun startLock(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current Activity")
            return
        }
        try {
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

    if (contents.includes("startLockTask()")) return config;

    const onResumeBlock = `
  override fun onResume() {
    super.onResume()
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
      try { startLockTask() } catch (e: Exception) { /* no-op if not device owner */ }
    }
  }`;

    const classBodyEnd = contents.lastIndexOf("}");
    if (classBodyEnd === -1) return config;

    config.modResults.contents =
      contents.slice(0, classBodyEnd) + onResumeBlock + "\n" + contents.slice(classBodyEnd);

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
