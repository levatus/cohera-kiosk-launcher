/**
 * Config plugin that writes the BluetoothStatusModule native Android module.
 *
 * The module exposes one method to JS:
 *   getBluetoothStatus(): Promise<{ enabled: boolean; connectedDevice: string | null }>
 *     — queries BluetoothAdapter and the A2DP profile for the first connected device.
 *     — catches SecurityException (missing BLUETOOTH_CONNECT at runtime) and
 *       returns { enabled, connectedDevice: null } rather than crashing.
 *
 * Note: BLUETOOTH_CONNECT permission is added statically in AndroidManifest.xml.
 */

const {
  withMainApplication,
  withDangerousMod,
} = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const BLUETOOTH_STATUS_MODULE_KT = (packageName) => `\
package ${packageName}

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
            val ctx: Context = reactApplicationContext
            val manager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = manager?.adapter

            val enabled = adapter?.isEnabled == true
            var connectedDevice: String? = null

            if (enabled && manager != null) {
                try {
                    // getConnectedDevices requires BLUETOOTH_CONNECT on API 31+
                    val connected = manager.getConnectedDevices(BluetoothProfile.A2DP)
                    connectedDevice = connected.firstOrNull()?.name
                } catch (e: SecurityException) {
                    // BLUETOOTH_CONNECT not granted at runtime — leave connectedDevice null
                }
            }

            val map = Arguments.createMap()
            map.putBoolean("enabled", enabled)
            if (connectedDevice != null) {
                map.putString("connectedDevice", connectedDevice)
            } else {
                map.putNull("connectedDevice")
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("BT_ERROR", e.message, e)
        }
    }
}
`;

const BLUETOOTH_STATUS_PACKAGE_KT = (packageName) => `\
package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BluetoothStatusPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> = listOf(BluetoothStatusModule(reactContext))

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
        path.join(javaDir, "BluetoothStatusModule.kt"),
        BLUETOOTH_STATUS_MODULE_KT(packageName)
      );
      fs.writeFileSync(
        path.join(javaDir, "BluetoothStatusPackage.kt"),
        BLUETOOTH_STATUS_PACKAGE_KT(packageName)
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

    if (contents.includes("BluetoothStatusPackage")) return config;

    const importLine = `import ${packageName}.BluetoothStatusPackage`;
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

    if (contents.includes("PackageList(this).packages.apply")) {
      contents = contents.replace(
        /(PackageList\(this\)\.packages\.apply \{)/,
        `$1\n              add(BluetoothStatusPackage())`
      );
    } else if (contents.includes("PackageList(this).packages")) {
      contents = contents.replace(
        /(val packages = PackageList\(this\)\.packages)/,
        `$1\n      packages.add(BluetoothStatusPackage())`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withBluetoothStatus(config) {
  config = writeKotlinFiles(config);
  config = patchMainApplication(config);
  return config;
};
