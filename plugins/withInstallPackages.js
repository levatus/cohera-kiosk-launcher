const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withInstallPackages(config) {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    if (!Array.isArray(manifest["uses-permission"])) {
      manifest["uses-permission"] = [];
    }

    const PERM = "android.permission.REQUEST_INSTALL_PACKAGES";
    const already = manifest["uses-permission"].some(
      (p) => p.$?.["android:name"] === PERM
    );
    if (!already) {
      manifest["uses-permission"].push({ $: { "android:name": PERM } });
    }

    return config;
  });
};
