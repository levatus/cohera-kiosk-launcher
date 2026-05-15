/**
 * Config plugin: SilentInstallerModule + BluetoothStatusModule
 *
 * SilentInstallerModule exposes:
 *   installApk(filePath: string): Promise<void>
 *     — opens a PackageInstaller session as Device Owner for silent APK install.
 *     — rejects with "NOT_DEVICE_OWNER" when app is not device owner.
 *
 * BluetoothStatusModule exposes:
 *   getBluetoothStatus(): Promise<{ enabled: boolean; connectedDevice: string | null }>
 *     — queries BluetoothManager for the first A2DP-connected device.
 *     — catches SecurityException and returns { enabled, connectedDevice: null }.
 *
 * Also adds BLUETOOTH_CONNECT permission to AndroidManifest.xml (Android 12+).
 */

const { withMainApplication, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Kotlin source templates
// ---------------------------------------------------------------------------

const SILENT_INSTALLER_MODULE_KT = (pkg) => `\
package ${pkg}

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
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            promise.reject("NOT_DEVICE_OWNER", "App is not device owner; cannot install silently")
            return
        }
        try {
            val normalized = filePath.removePrefix("file://")
            val file = File(normalized)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "APK file not found: $normalized")
                return
            }
            val packageInstaller = context.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            val sessionId = packageInstaller.createSession(params)
            val session = packageInstaller.openSession(sessionId)
            file.inputStream().use { input ->
                session.openWrite("package", 0, file.length()).use { output ->
                    input.copyTo(output)
                    session.fsync(output)
                }
            }
            val intent = Intent("\${context.packageName}.SILENT_INSTALL_COMPLETE")
                .setPackage(context.packageName)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT
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

const SILENT_INSTALLER_PACKAGE_KT = (pkg) => `\
package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SilentInstallerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SilentInstallerModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

const BLUETOOTH_STATUS_MODULE_KT = (pkg) => `\
package ${pkg}

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BluetoothStatusModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BluetoothStatusModule"

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getBluetoothStatus(promise: Promise) {
        try {
            val manager = reactApplicationContext
                .getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val enabled = manager?.adapter?.isEnabled == true
            var connectedDevice: String? = null
            if (enabled && manager != null) {
                try {
                    connectedDevice = manager
                        .getConnectedDevices(BluetoothProfile.A2DP)
                        .firstOrNull()?.name
                } catch (e: SecurityException) {
                    // BLUETOOTH_CONNECT not granted at runtime
                }
            }
            val map = Arguments.createMap()
            map.putBoolean("enabled", enabled)
            if (connectedDevice != null) map.putString("connectedDevice", connectedDevice)
            else map.putNull("connectedDevice")
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("BT_ERROR", e.message, e)
        }
    }
}
`;

const BLUETOOTH_STATUS_PACKAGE_KT = (pkg) => `\
package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BluetoothStatusPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(BluetoothStatusModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

// ---------------------------------------------------------------------------
// Single withDangerousMod: writes all 4 .kt files + patches AndroidManifest
// ---------------------------------------------------------------------------

function writeNativeFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const pkg = config.android?.package ?? "com.clinic.kioskbrowser";
      const javaDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java",
        pkg.replace(/\./g, "/")
      );
      fs.mkdirSync(javaDir, { recursive: true });

      fs.writeFileSync(path.join(javaDir, "SilentInstallerModule.kt"), SILENT_INSTALLER_MODULE_KT(pkg));
      fs.writeFileSync(path.join(javaDir, "SilentInstallerPackage.kt"), SILENT_INSTALLER_PACKAGE_KT(pkg));
      fs.writeFileSync(path.join(javaDir, "BluetoothStatusModule.kt"), BLUETOOTH_STATUS_MODULE_KT(pkg));
      fs.writeFileSync(path.join(javaDir, "BluetoothStatusPackage.kt"), BLUETOOTH_STATUS_PACKAGE_KT(pkg));

      // Add BLUETOOTH_CONNECT permission to AndroidManifest.xml if not already present
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/AndroidManifest.xml"
      );
      if (fs.existsSync(manifestPath)) {
        let manifest = fs.readFileSync(manifestPath, "utf8");
        const permission = "android.permission.BLUETOOTH_CONNECT";
        if (!manifest.includes(permission)) {
          manifest = manifest.replace(
            /(<manifest[^>]*>)/,
            `$1\n\n  <uses-permission android:name="${permission}"/>`
          );
          fs.writeFileSync(manifestPath, manifest, "utf8");
        }
      }

      return config;
    },
  ]);
}

// ---------------------------------------------------------------------------
// Single withMainApplication: registers both packages in one pass
// ---------------------------------------------------------------------------

function patchMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    const pkg = config.android?.package ?? "com.clinic.kioskbrowser";

    // --- SilentInstallerPackage ---
    if (!contents.includes("SilentInstallerPackage")) {
      const imp = `import ${pkg}.SilentInstallerPackage`;
      if (!contents.includes(imp)) {
        contents = contents.replace(
          /import com\.facebook\.react\.ReactApplication/,
          `import com.facebook.react.ReactApplication\n${imp}`
        );
      }
      if (contents.includes("PackageList(this).packages.apply")) {
        contents = contents.replace(
          /(PackageList\(this\)\.packages\.apply \{)/,
          `$1\n              add(SilentInstallerPackage())`
        );
      }
    }

    // --- BluetoothStatusPackage ---
    if (!contents.includes("BluetoothStatusPackage")) {
      const imp = `import ${pkg}.BluetoothStatusPackage`;
      if (!contents.includes(imp)) {
        contents = contents.replace(
          /import com\.facebook\.react\.ReactApplication/,
          `import com.facebook.react.ReactApplication\n${imp}`
        );
      }
      if (contents.includes("PackageList(this).packages.apply")) {
        contents = contents.replace(
          /(PackageList\(this\)\.packages\.apply \{)/,
          `$1\n              add(BluetoothStatusPackage())`
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withSilentInstaller(config) {
  config = writeNativeFiles(config);
  config = patchMainApplication(config);
  return config;
};
