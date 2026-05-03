import { useCallback, useEffect, useRef, useState } from "react";
import * as Updates from "expo-updates";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import { Platform } from "react-native";

const GITHUB_REPO = "levatus/cohera-kiosk-launcher";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** Local time hour (24-h) at which the daily forced update check runs. */
const EVENING_HOUR = 21; // 9 PM

export interface AppUpdateState {
  isUpdating: boolean;
  updateProgress: number;
  updateError: string | null;
  latestBuild: number;
}

export interface UseAppUpdateResult extends AppUpdateState {
  /** Manually trigger a forced update check (for AdminMenu). */
  checkNow: () => void;
}

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name?: string;
  assets?: GithubAsset[];
}

async function applyEASUpdate(): Promise<void> {
  if (__DEV__) return;
  try {
    if (!Updates.isEnabled) return;
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Silent — best-effort OTA
  }
}

/** Returns ms until the next occurrence of `hour:00` local time. */
function msUntilHour(hour: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

export function useAppUpdate(): UseAppUpdateResult {
  const launchChecked = useRef(false);
  const eveningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<AppUpdateState>({
    isUpdating: false,
    updateProgress: 0,
    updateError: null,
    latestBuild: 0,
  });

  /**
   * Check GitHub Releases for a newer versionCode.
   * If found, download and launch the Android package installer immediately.
   */
  const forceUpdateIfAvailable = useCallback(async () => {
    if (Platform.OS !== "android") return;

    try {
      const res = await fetch(RELEASES_URL, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) return;

      const release = (await res.json()) as GithubRelease;
      const match = release.tag_name?.match(/^build-(\d+)$/);
      if (!match) return;

      const latestBuild = parseInt(match[1], 10);
      const currentBuild = Constants.expoConfig?.android?.versionCode ?? 1;

      if (latestBuild <= currentBuild) return;

      // Newer build found — start forced download
      const asset = release.assets?.find((a) => a.name.endsWith(".apk"));
      if (!asset) return;

      setState((s) => ({
        ...s,
        isUpdating: true,
        updateProgress: 0,
        updateError: null,
        latestBuild,
      }));

      const localUri = `${FileSystem.cacheDirectory ?? ""}kiosk-update.apk`;

      const download = FileSystem.createDownloadResumable(
        asset.browser_download_url,
        localUri,
        {},
        (progress: FileSystem.DownloadProgressData) => {
          const total = progress.totalBytesExpectedToWrite;
          const pct = total > 0 ? progress.totalBytesWritten / total : 0;
          setState((s) => ({ ...s, updateProgress: pct }));
        }
      );

      await download.downloadAsync();

      const contentUri = await FileSystem.getContentUriAsync(localUri);

      // Hand off to Android package installer
      await IntentLauncher.startActivityAsync(
        "android.intent.action.INSTALL_PACKAGE",
        {
          data: contentUri,
          flags: 1,
          type: "application/vnd.android.package-archive",
        }
      );

      setState((s) => ({ ...s, isUpdating: false }));
    } catch (e) {
      setState((s) => ({
        ...s,
        isUpdating: false,
        updateError: e instanceof Error ? e.message : "Update failed",
      }));
    }
  }, []);

  /** Schedule the next evening check, then reschedule every 24 h. */
  const scheduleEveningCheck = useCallback(() => {
    const delay = msUntilHour(EVENING_HOUR);
    eveningTimer.current = setTimeout(() => {
      void forceUpdateIfAvailable();
      scheduleEveningCheck(); // reschedule for same time tomorrow
    }, delay);
  }, [forceUpdateIfAvailable]);

  useEffect(() => {
    if (launchChecked.current) return;
    launchChecked.current = true;

    // 1. EAS OTA bundle update — 5 s after launch
    const t1 = setTimeout(() => {
      void applyEASUpdate();
    }, 5_000);

    // 2. APK version check — 10 s after launch (forced install if newer)
    const t2 = setTimeout(() => {
      void forceUpdateIfAvailable();
    }, 10_000);

    // 3. Daily evening check
    scheduleEveningCheck();

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (eveningTimer.current) clearTimeout(eveningTimer.current);
    };
  }, [forceUpdateIfAvailable, scheduleEveningCheck]);

  return {
    ...state,
    checkNow: forceUpdateIfAvailable,
  };
}
