/**
 * useNetworkDiagnostics
 *
 * Measures round-trip latency to the EMR by doing a HEAD request.
 * Re-runs whenever `enabled` flips to true (e.g., admin menu opens).
 */

import { useEffect, useState } from "react";

export interface NetworkDiagnostics {
  checking: boolean;
  isOnline: boolean;
  latencyMs: number | null;
}

export function useNetworkDiagnostics(
  emrUrl: string,
  enabled: boolean
): NetworkDiagnostics {
  const [state, setState] = useState<NetworkDiagnostics>({
    checking: false,
    isOnline: false,
    latencyMs: null,
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setState({ checking: true, isOnline: false, latencyMs: null });

    const start = Date.now();
    fetch(emrUrl, { method: "HEAD", cache: "no-store" })
      .then(() => {
        if (!cancelled)
          setState({ checking: false, isOnline: true, latencyMs: Date.now() - start });
      })
      .catch(() => {
        if (!cancelled)
          setState({ checking: false, isOnline: false, latencyMs: null });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, emrUrl]);

  return state;
}
