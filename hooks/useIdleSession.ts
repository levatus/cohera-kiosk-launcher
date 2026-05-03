/**
 * useIdleSession
 *
 * Detects inactivity inside the WebView and fires onIdle() after timeoutMs.
 * The WebView must use activityInjectedJs to forward touch/scroll events.
 * Call handleActivityMessage(data) from onMessage — it returns true when the
 * message was an activity ping so the caller can skip other processing.
 * Call resetIdle() from the attract screen to dismiss it and re-arm the timer.
 */

import { useCallback, useEffect, useRef } from "react";

/** Default 3 minutes of inactivity before idle triggers. */
const DEFAULT_IDLE_MS = 3 * 60 * 1000;

/** JS injected into the WebView to post activity messages back to RN. */
export const ACTIVITY_INJECTED_JS = `
(function() {
  if (window.__kioskIdleWired) return;
  window.__kioskIdleWired = true;
  function ping() {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'kiosk_activity' })); }
    catch (_) {}
  }
  ['touchstart','scroll','click','keydown'].forEach(function(evt) {
    document.addEventListener(evt, ping, { passive: true, capture: true });
  });
})();
`;

interface Options {
  timeoutMs?: number;
  onIdle: () => void;
}

export function useIdleSession({ timeoutMs = DEFAULT_IDLE_MS, onIdle }: Options) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onIdleRef.current();
    }, timeoutMs);
  }, [timeoutMs]);

  const resetIdle = useCallback(() => {
    arm();
  }, [arm]);

  /** Call this from WebView onMessage. Returns true if the message was consumed. */
  const handleActivityMessage = useCallback(
    (data: string): boolean => {
      try {
        const msg = JSON.parse(data) as { type?: string };
        if (msg.type === "kiosk_activity") {
          arm();
          return true;
        }
      } catch {
        // not JSON — ignore
      }
      return false;
    },
    [arm]
  );

  // Arm on mount
  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [arm]);

  return { resetIdle, handleActivityMessage };
}
