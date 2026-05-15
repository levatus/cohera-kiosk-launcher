/**
 * Config plugin that writes a SilentInstallerModule native Android module.
 *
 * The module exposes one method to JS:
 *   installApk(filePath: string): Promise<void>
 *     — opens a PackageInstaller session as Device Owner and commits the APK
 *       completely silently (no Android install dialog).
 *     — rejects with code "NOT_DEVICE_OWNER" when the app is not the device
 *       owner so the caller can fall back to the intent-launcher path.
 *
 * The file path must be a local path or file:// URI pointing to the APK.
 */

const {
  withMainApplication,
  withDangerousMod,
} = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const SILENT_INSTALLER_MODULE_KT = (packageName) => `\
package ${packageName}

import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class SilentInstallerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SilentInstallerModule"

    @ReactMethod
    fun installApk(filePath: String, promise: Promise) {
        val context = reactApplicationContext

        // Require Device Owner so the install is truly silent.
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            promise.reject("NOT_DEVICE_OWNER", "App is not device owner; cannot install silently")
            return
        }

        try {
            // Strip a leading file:// scheme if present (expo-file-system returns file:// URIs).
            val normalized = filePath.removePrefix("file://")
            val file = File(normalized)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "APK file not found: $normalized")
                return
            }

            val packageInstaller = context.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(
                PackageInstaller.SessionParams.MODE_FULL_INSTALL
            )

            val sessionId = packageInstaller.createSession(params)
            val session = packageInstaller.openSession(sessionId)

            file.inputStream().use { input ->
                session.openWrite("package", 0, file.length()).use { output ->
                    input.copyTo(output)
                    session.fsync(output)
                }
            }

            val intent = Intent("${context.packageName}.SILENT_INSTALL_COMPLETE")
                .setPackage(context.packageName)

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getBroadcast(context, sessionId, intent, flags)
            session.commit(pendingIntent.intentSender)
            session.close()

            promise.resolve(null)
        } catch (e: SecurityException) {
            promise.reject("NOT_DEVICE_OWNER", e.message, e)
        } catch (e: Exception) {
            promise.reject("INSTALL_FAILED", e.message, e)
        }
    }
}
`;

const SILENT_INSTALLER_PACKAGE_KT = (packageName) => `\
package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SilentInstallerPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> = listOf(SilentInstallerModule(reactContext))

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
        path.join(javaDir, "SilentInstallerModule.kt"),
        SILENT_INSTALLER_MODULE_KT(packageName)
      );
      fs.writeFileSync(
        path.join(javaDir, "SilentInstallerPackage.kt"),
        SILENT_INSTALLER_PACKAGE_KT(packageName)
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

    if (contents.includes("SilentInstallerPackage")) return config;

    // Add import
    const importLine = `import ${packageName}.SilentInstallerPackage`;
    if (!contents.includes(importLine)) {
      if (contents.includes("import com.facebook.react.ReactApplication")) {
        contents = contents.replace(
          /import com\.facebook\.react\.ReactApplication/,
          `import com.facebook.react.ReactApplication\n${importLine}`
        );
      } else {
        contents = contents.replace(
          /^(package .+\n)/,
          `$1${importLine}\n`
        );
      }
    }

    // Expo SDK 52+ / RN 0.76+ format: PackageList(this).packages.apply { ... }
    if (contents.includes("PackageList(this).packages.apply")) {
      contents = contents.replace(
        /(PackageList\(this\)\.packages\.apply \{)/,
        `$1\n              add(SilentInstallerPackage())`
      );
    } else if (contents.includes("PackageList(this).packages")) {
      // Older format: val packages = PackageList(this).packages
      contents = contents.replace(
        /(val packages = PackageList\(this\)\.packages)/,
        `$1\n      packages.add(SilentInstallerPackage())`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withSilentInstaller(config) {
  config = writeKotlinFiles(config);
  config = patchMainApplication(config);
  return config;
};
