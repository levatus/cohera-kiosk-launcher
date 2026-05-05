/**
 * Config plugin that adds a DeviceAdminReceiver to the kiosk app.
 *
 * During `expo prebuild` this plugin:
 *  1. Writes KioskDeviceAdminReceiver.kt into the Android source tree.
 *  2. Writes res/xml/device_admin.xml declaring the admin policies.
 *  3. Patches AndroidManifest.xml to register the receiver with the
 *     ACTION_DEVICE_ADMIN_ENABLED intent filter and meta-data pointing
 *     to the policies XML.
 *
 * After installing the APK built from this code, run once on the tablet:
 *   adb shell dpm set-device-owner com.clinic.kioskbrowser/.KioskDeviceAdminReceiver
 * (The tablet must have no Google accounts added before running this.)
 */

const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const DEVICE_ADMIN_RECEIVER_KT = (packageName) => `\
package ${packageName}

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

class KioskDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        // Device admin privileges granted — lock task mode will be activated
        // automatically by MainActivity.onResume().
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
    }
}
`;

const DEVICE_ADMIN_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<device-admin>
    <uses-policies>
        <!-- Required for Device Owner lock-task mode -->
        <force-lock />
    </uses-policies>
</device-admin>
`;

function writeKotlinReceiver(config) {
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
        path.join(javaDir, "KioskDeviceAdminReceiver.kt"),
        DEVICE_ADMIN_RECEIVER_KT(packageName)
      );

      return config;
    },
  ]);
}

function writeDeviceAdminXml(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );

      fs.mkdirSync(xmlDir, { recursive: true });

      fs.writeFileSync(path.join(xmlDir, "device_admin.xml"), DEVICE_ADMIN_XML);

      return config;
    },
  ]);
}

function addReceiverToManifest(config) {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;
    const application = manifest.application?.[0];
    if (!application) return config;

    const packageName =
      config.android?.package ?? "com.clinic.kioskbrowser";

    if (!application.receiver) {
      application.receiver = [];
    }

    const alreadyRegistered = application.receiver.some(
      (r) =>
        r.$?.["android:name"] === `.KioskDeviceAdminReceiver` ||
        r.$?.["android:name"] === `${packageName}.KioskDeviceAdminReceiver`
    );

    if (!alreadyRegistered) {
      application.receiver.push({
        $: {
          "android:name": ".KioskDeviceAdminReceiver",
          "android:label": "@string/app_name",
          "android:description": "@string/app_name",
          "android:permission": "android.permission.BIND_DEVICE_ADMIN",
          "android:exported": "true",
        },
        "meta-data": [
          {
            $: {
              "android:name": "android.app.device_admin",
              "android:resource": "@xml/device_admin",
            },
          },
        ],
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.app.action.DEVICE_ADMIN_ENABLED",
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = function withDeviceAdmin(config) {
  config = writeKotlinReceiver(config);
  config = writeDeviceAdminXml(config);
  config = addReceiverToManifest(config);
  return config;
};
