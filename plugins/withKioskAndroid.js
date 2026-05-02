const { withAndroidManifest } = require("@expo/config-plugins");

function addHomeIntentFilter(activity) {
  if (!activity["intent-filter"]) {
    activity["intent-filter"] = [];
  }

  const hasHome = activity["intent-filter"].some((filter) =>
    (filter.category || []).some(
      (cat) => cat.$["android:name"] === "android.intent.category.HOME"
    )
  );

  if (!hasHome) {
    activity["intent-filter"].push({
      action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
      category: [
        { $: { "android:name": "android.intent.category.HOME" } },
        { $: { "android:name": "android.intent.category.DEFAULT" } },
      ],
    });
  }
}

function setLaunchMode(activity) {
  if (!activity.$) activity.$ = {};
  activity.$["android:launchMode"] = "singleTask";
}

module.exports = function withKioskAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;
    const application = manifest.application?.[0];
    if (!application) return config;

    const mainActivity = application.activity?.[0];
    if (!mainActivity) return config;

    setLaunchMode(mainActivity);
    addHomeIntentFilter(mainActivity);

    return config;
  });
};
