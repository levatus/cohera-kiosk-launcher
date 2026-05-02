/**
 * Config plugin that writes a ScreenControlModule native Android module.
 *
 * The module exposes two methods to JS:
 *   wakeScreen()  — turns the display on (FULL_WAKE_LOCK + ACQUIRE_CAUSES_WAKEUP,
 *                   or Activity.setTurnScreenOn on API 27+)
 *   lockScreen()  — turns the display off via DevicePolicyManager.lockNow()
 *                   (requires Device Owner / Device Admin; rejects otherwise)
 *
 * JS fall-back: if lockScreen() rejects (not Device Admin), the app shows
 * a full-screen black overlay instead so the visual effect is still achieved.
 */

const {
  withMainApplication,
  withDangerousMod,
} = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const SCREEN_CONTROL_MODULE_KT = (packageName) => `\
package ${packageName}

import android.app.KeyguardManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ScreenControlModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ScreenControlModule"

    @ReactMethod
    fun wakeScreen(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current Activity")
            return
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                activity.runOnUiThread {
                    activity.setTurnScreenOn(true)
                    activity.setShowWhenLocked(true)
                    val km = activity.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
                    km.requestDismissKeyguard(activity, null)
                }
            } else {
                @Suppress("DEPRECATION")
                val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
                @Suppress("DEPRECATION")
                val wl = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                    "kioskbrowser::ScreenWake"
                )
                wl.acquire(3000L)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WAKE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun lockScreen(promise: Promise) {
        try {
            val dpm = reactApplicationContext
                .getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            dpm.lockNow()
            promise.resolve(null)
        } catch (e: SecurityException) {
            promise.reject("NOT_DEVICE_ADMIN", "Device admin required to lock screen", e)
        } catch (e: Exception) {
            promise.reject("LOCK_FAILED", e.message, e)
        }
    }
}
`;

const SCREEN_CONTROL_PACKAGE_KT = (packageName) => `\
package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ScreenControlPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> = listOf(ScreenControlModule(reactContext))

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
        path.join(javaDir, "ScreenControlModule.kt"),
        SCREEN_CONTROL_MODULE_KT(packageName)
      );
      fs.writeFileSync(
        path.join(javaDir, "ScreenControlPackage.kt"),
        SCREEN_CONTROL_PACKAGE_KT(packageName)
      );

      return config;
    },
  ]);
}

function patchMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    const packageName =
      config.android?.package ?? "com.clinic.kioskbrowser";

    if (contents.includes("ScreenControlPackage")) return config;

    contents = contents.replace(
      /import com\.facebook\.react\.ReactApplication/,
      `import com.facebook.react.ReactApplication\nimport ${packageName}.ScreenControlPackage`
    );

    contents = contents.replace(
      /(val packages = PackageList\(this\)\.packages)/,
      `$1\n      packages.add(ScreenControlPackage())`
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withScreenControl(config) {
  config = writeKotlinFiles(config);
  config = patchMainApplication(config);
  return config;
};
