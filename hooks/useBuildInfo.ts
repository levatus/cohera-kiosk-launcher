/**
 * Tracks when each versionCode was first launched on this device.
 * On startup, if the stored build differs from the current build,
 * the install timestamp is refreshed automatically.
 */

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const STORAGE_KEY = "kiosk_build_info";

export interface BuildInfo {
  build: number;
  /** Formatted string like "May 3, 2026 · 5:42 PM" */
  installedAt: string;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " · " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function useBuildInfo(): BuildInfo | null {
  const [info, setInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    const currentBuild = Constants.expoConfig?.android?.versionCode ?? 0;

    async function init() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const stored = raw ? (JSON.parse(raw) as { build: number; ts: number }) : null;

        if (stored?.build === currentBuild) {
          setInfo({ build: currentBuild, installedAt: formatDate(stored.ts) });
        } else {
          const ts = Date.now();
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ build: currentBuild, ts })
          );
          setInfo({ build: currentBuild, installedAt: formatDate(ts) });
        }
      } catch {
        setInfo({ build: currentBuild, installedAt: "unknown" });
      }
    }

    void init();
  }, []);

  return info;
}
