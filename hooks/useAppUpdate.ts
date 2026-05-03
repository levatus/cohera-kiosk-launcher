import { useCallback, useEffect, useRef, useState } from "react";
import * as Updates from "expo-updates";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import { Platform } from "react-native";

const GITHUB_REPO = "levatus/cohera-kiosk-launcher";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface AppUpdateState {
  apkUpdateAvailable: boolean;
  apkLatestBuild: number;
  apkDownloading: boolean;
  apkDownloadProgress: number;
  apkError: string | null;
}

export interface UseAppUpdateResult extends AppUpdateState {
  installAPK: () => Promise<void>;
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

export function useAppUpdate(): UseAppUpdateResult {
  const checked = useRef(false);
  const [state, setState] = useState<AppUpdateState>({
    apkUpdateAvailable: false,
    apkLatestBuild: 0,
    apkDownloading: false,
    apkDownloadProgress: 0,
    apkError: null,
  });

  const checkAPKUpdate = useCallback(async () => {
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
      if (latestBuild > currentBuild) {
        setState((s) => ({ ...s, apkUpdateAvailable: true, apkLatestBuild: latestBuild }));
      }
    } catch {
      // Silent — no connectivity or no releases yet
    }
  }, []);

  const installAPK = useCallback(async () => {
    setState((s) => ({ ...s, apkDownloading: true, apkDownloadProgress: 0, apkError: null }));
    try {
      const res = await fetch(RELEASES_URL, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error("Could not reach GitHub releases");
      const release = (await res.json()) as GithubRelease;
      const asset = release.assets?.find((a) => a.name.endsWith(".apk"));
      if (!asset) throw new Error("No APK found in latest release");

      const localUri = `${FileSystem.cacheDirectory ?? ""}kiosk-update.apk`;

      const download = FileSystem.createDownloadResumable(
        asset.browser_download_url,
        localUri,
        {},
        (progress: FileSystem.DownloadProgressData) => {
          const total = progress.totalBytesExpectedToWrite;
          const pct = total > 0 ? progress.totalBytesWritten / total : 0;
          setState((s) => ({ ...s, apkDownloadProgress: pct }));
        }
      );

      await download.downloadAsync();

      const contentUri = await FileSystem.getContentUriAsync(localUri);
      setState((s) => ({ ...s, apkDownloading: false }));

      await IntentLauncher.startActivityAsync(
        "android.intent.action.INSTALL_PACKAGE",
        {
          data: contentUri,
          flags: 1,
          type: "application/vnd.android.package-archive",
        }
      );
    } catch (e) {
      setState((s) => ({
        ...s,
        apkDownloading: false,
        apkError: e instanceof Error ? e.message : "Update failed",
      }));
    }
  }, []);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // EAS OTA update check — 5 s after startup
    const t1 = setTimeout(() => {
      void applyEASUpdate();
    }, 5_000);

    // APK version check — 10 s after startup
    const t2 = setTimeout(() => {
      void checkAPKUpdate();
    }, 10_000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [checkAPKUpdate]);

  return {
    ...state,
    installAPK,
    checkNow: checkAPKUpdate,
  };
}
