/**
 * useConnectionStatus
 *
 * Runs a periodic HEAD request to the EMR server and derives a simple
 * connection status: 'online' | 'degraded' | 'offline'.
 *
 * Thresholds:
 *   - 2 consecutive failures → 'offline'
 *   - 1 failure OR latency > 2000 ms → 'degraded'
 *   - latency ≤ 2000 ms, no recent failures → 'online'
 *
 * Auto-reload:
 *   - After FAILURES_FOR_AUTORELOAD (3) consecutive failures (~45 s at the
 *     15 s interval) the onAutoReload callback fires exactly once per crossing.
 *     The counter resets after the callback so repeat reloads can occur if the
 *     network remains down.
 */

import { useEffect, useRef, useState } from "react";

export type ConnectionStatus = "online" | "degraded" | "offline";

const HEARTBEAT_INTERVAL_MS = 15_000;
const LATENCY_DEGRADED_MS = 2_000;
const FAILURES_FOR_OFFLINE = 2;
const FAILURES_FOR_AUTORELOAD = 3;

interface UseConnectionStatusOptions {
  onAutoReload?: (consecutiveFailures: number) => void;
}

export function useConnectionStatus(
  emrUrl: string,
  options?: UseConnectionStatusOptions,
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("degraded");
  // Tracks consecutive failures for offline-status display (never reset by
  // the auto-reload threshold so the connection dot doesn't flicker).
  const consecutiveFailuresRef = useRef(0);
  // Separate counter used only for the auto-reload threshold. Resets to 0
  // after the callback fires so a second crossing can occur while the network
  // remains down, without touching the status counter.
  const autoReloadCounterRef = useRef(0);
  const mountedRef = useRef(true);
  const onAutoReloadRef = useRef(options?.onAutoReload);

  useEffect(() => {
    onAutoReloadRef.current = options?.onAutoReload;
  }, [options?.onAutoReload]);

  useEffect(() => {
    mountedRef.current = true;

    async function ping() {
      if (!mountedRef.current) return;
      const start = Date.now();
      try {
        await fetch(emrUrl, { method: "HEAD", cache: "no-store" });
        const latency = Date.now() - start;
        if (!mountedRef.current) return;
        consecutiveFailuresRef.current = 0;
        autoReloadCounterRef.current = 0;
        setStatus(latency > LATENCY_DEGRADED_MS ? "degraded" : "online");
      } catch {
        if (!mountedRef.current) return;
        consecutiveFailuresRef.current += 1;
        autoReloadCounterRef.current += 1;
        setStatus(
          consecutiveFailuresRef.current >= FAILURES_FOR_OFFLINE
            ? "offline"
            : "degraded"
        );
        if (autoReloadCounterRef.current === FAILURES_FOR_AUTORELOAD) {
          const cb = onAutoReloadRef.current;
          // Reset only the auto-reload counter so repeat reloads can occur
          // while the network remains down, without affecting the status dot.
          autoReloadCounterRef.current = 0;
          cb?.(FAILURES_FOR_AUTORELOAD);
        }
      }
    }

    ping();
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [emrUrl]);

  return status;
}
