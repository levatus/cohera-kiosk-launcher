/**
 * useAppUpdate
 *
 * On mount (with a 3-second delay so the WebView can start loading),
 * checks the latest GitHub Release for a newer APK build number.
 * If a newer build is found it immediately begins downloading it
 * and then installs it.
 *
 * Install path (tried in order):
 *  1. SilentInstaller.installApk() — Device Owner PackageInstaller session;
 *     no Android dialog appears. Only works when the app is set as Device Owner.
 *  2. expo-intent-launcher fallback — fires the standard ACTION_VIEW intent,
 *     which shows Android's "Install" dialog. Used when not device owner.
 *
 * Release tag format: "build-N"  (e.g. "build-41")
 * Current build number comes from Constants.expoConfig?.android?.versionCode,
 * which is set to the GitHub Actions run number by the CI workflow.
 *
 * Phases
 * ──────
 *  idle        → initial state
 *  checking    → fetching releases API
 *  no-update   → remote build ≤ local build; nothing to do
 *  downloading → newer build found; APK download in progress
 *  installing  → download complete; install triggered
 *  error       → any failure (network, parse, download, intent)
 */

import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { installApk } from "@/modules/SilentInstaller";

const GITHUB_REPO = "levatus/cohera-kiosk-launcher";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const CHECK_DELAY_MS = 3_000;

export type UpdatePhase =
  | "idle"
  | "checking"
  | "no-update"
  | "downloading"
  | "installing"
  | "error";

export interface AppUpdateState {
  updateAvailable: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  phase: UpdatePhase;
  /** ISO timestamp of when the latest GitHub Release was published (i.e. when the remote APK was built). */
  latestBuildCreatedAt: string | null;
  /**
   * ISO timestamp of when the currently-installed build was compiled.
   * Sourced from Constants.expoConfig?.extra?.buildTimestamp, which the CI
   * workflow (build-kiosk-apk.yml) should patch into app.json before each
   * EAS build. Empty string when running a local/dev build.
   */
  currentBuildCreatedAt: string;
  /** No-op: download starts automatically when an update is detected. */
  startUpdate: () => void;
  /**
   * Manually trigger the same update check that runs automatically on mount.
   * Safe to call at any time; ignored while a check/download/install is
   * already in progress.
   */
  checkForUpdates: () => void;
  /** True while a GitHub release check is in flight. */
  checking: boolean;
  /** True when the install was performed silently (Device Owner path). */
  silentInstall: boolean;
}

export function useAppUpdate(): AppUpdateState {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [latestBuildCreatedAt, setLatestBuildCreatedAt] = useState<string | null>(null);
  const [silentInstall, setSilentInstall] = useState(false);

  const mountedRef = useRef(true);
  const apkUrlRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const download = useCallback(async () => {
    const apkUrl = apkUrlRef.current;
    if (!apkUrl || !mountedRef.current) return;

    setPhase("downloading");
    setProgress(0);

    const dest = (FileSystem.cacheDirectory ?? "") + "kiosk-update.apk";

    try {
      await FileSystem.deleteAsync(dest, { idempotent: true });

      const downloadResumable = FileSystem.createDownloadResumable(
        apkUrl,
        dest,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0 && mountedRef.current) {
            setProgress(
              Math.round(
                (totalBytesWritten / totalBytesExpectedToWrite) * 100
              )
            );
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result?.uri) throw new Error("Download returned no URI");

      if (!mountedRef.current) return;
      setPhase("installing");

      // Attempt silent install via Device Owner PackageInstaller first.
      try {
        await installApk(result.uri);
        if (mountedRef.current) setSilentInstall(true);
        // Silent install committed successfully — the system will handle the
        // actual APK installation and app restart; nothing more to do here.
        return;
      } catch (silentErr) {
        const code = (silentErr as { code?: string }).code;
        if (code !== "NOT_DEVICE_OWNER") {
          // Unexpected error from silent installer — still fall through to intent.
          // Log it but don't surface to the user.
        }
        // Fall back to intent launcher.
      }

      const contentUri = await FileSystem.getContentUriAsync(result.uri);

      await IntentLauncher.startActivityAsync(
        "android.intent.action.VIEW",
        {
          data: contentUri,
          flags: 1,
          type: "application/vnd.android.package-archive",
        }
      );
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    }
  }, []);

  const runCheck = useCallback(async () => {
    if (!mountedRef.current) return;
    setPhase("checking");
    setError(null);

    try {
      const res = await fetch(RELEASES_URL, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

      const data = await res.json();

      const tag: string = data.tag_name ?? "";
      const remoteN = parseInt(tag.replace("build-", ""), 10);
      if (isNaN(remoteN)) throw new Error(`Unexpected tag: "${tag}"`);

      const publishedAt: string | null = data.published_at ?? null;
      if (publishedAt && mountedRef.current) {
        setLatestBuildCreatedAt(publishedAt);
      }

      const localN: number =
        Constants.expoConfig?.android?.versionCode ?? 0;

      const apkAsset = (data.assets ?? []).find(
        (a: { name: string; browser_download_url: string }) =>
          a.name.endsWith(".apk")
      );
      if (!apkAsset) throw new Error("No APK asset found in release");

      apkUrlRef.current = apkAsset.browser_download_url as string;

      if (!mountedRef.current) return;

      if (remoteN <= localN) {
        setPhase("no-update");
        return;
      }

      await download();
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    }
  }, [download]);

  // Automatic check on mount after a short delay.
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const timer = setTimeout(runCheck, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [runCheck]);

  const checkForUpdates = useCallback(() => {
    if (Platform.OS !== "android") return;
    // Don't interrupt an ongoing download or install.
    if (
      phase === "downloading" ||
      phase === "installing" ||
      phase === "checking"
    ) {
      return;
    }
    runCheck();
  }, [phase, runCheck]);

  const currentBuildCreatedAt: string =
    (Constants.expoConfig?.extra as { buildTimestamp?: string } | undefined)
      ?.buildTimestamp ?? "";

  return {
    updateAvailable: phase === "downloading" || phase === "installing",
    downloading: phase === "downloading",
    progress,
    error,
    phase,
    latestBuildCreatedAt,
    currentBuildCreatedAt,
    startUpdate: () => {
      // Download begins automatically when an update is detected; this is a no-op.
    },
    checkForUpdates,
    checking: phase === "checking",
    silentInstall,
  };
}
