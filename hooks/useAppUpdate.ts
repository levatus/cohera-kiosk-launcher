/**
 * useAppUpdate
 *
 * On mount (with a 3-second delay so the WebView can start loading),
 * checks the latest GitHub Release for a newer APK build number.
 * If a newer build is found it immediately begins downloading it
 * and then hands it to Android's native package installer.
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
 *  installing  → download complete; install intent fired
 *  error       → any failure (network, parse, download, intent)
 */

import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

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
}

export function useAppUpdate(): AppUpdateState {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const apkUrlRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const run = async () => {
      if (!mountedRef.current) return;
      setPhase("checking");

      try {
        const res = await fetch(RELEASES_URL, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

        const data = await res.json();

        const tag: string = data.tag_name ?? "";
        const remoteN = parseInt(tag.replace("build-", ""), 10);
        if (isNaN(remoteN)) throw new Error(`Unexpected tag: "${tag}"`);

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
    };

    const download = async () => {
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
    };

    const timer = setTimeout(run, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return {
    updateAvailable: phase === "downloading" || phase === "installing",
    downloading: phase === "downloading",
    progress,
    error,
    phase,
  };
}
