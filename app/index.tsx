import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  DimensionValue,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { AdminMenu } from "@/components/AdminMenu";
import { PinModal } from "@/components/PinModal";
import { ScheduleModal } from "@/components/ScheduleModal";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { useBluetooth } from "@/hooks/useBluetooth";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useKioskLock } from "@/hooks/useKioskLock";
import { setKeepScreenOn } from "@/modules/ScreenControl";
import { useScreenSchedule } from "@/hooks/useScreenSchedule";
import { closeApp } from "@/modules/LockTask";

const EMR_URL =
  process.env.EXPO_PUBLIC_EMR_URL ?? "https://health-record-hub-slinuw.replit.app";

export default function KioskScreen() {
  useKeepAwake();

  useEffect(() => {
    setKeepScreenOn(true).catch(() => {});
  }, []);

  const webViewRef = useRef<WebView>(null);
  const [hasError, setHasError] = useState(false);

  const { isLocked, lastError, relockSecondsLeft, lock, unlock } = useKioskLock();

  const [showPin, setShowPin] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    if (!isLocked) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      webViewRef.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [isLocked]);

  const handleScheduledRefresh = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  const { schedule, screenOn, saveSchedule } = useScreenSchedule({
    onRefresh: handleScheduledRefresh,
  });

  const { updateAvailable, downloading, progress, phase, checkForUpdates, checking, silentInstall } = useAppUpdate();
  const [upToDate, setUpToDate] = useState(false);

  // ─── Auto-update daily scheduler ────────────────────────────────────────

  const { settings: autoUpdateSettings, saveSettings: saveAutoUpdateSettings } =
    useAutoUpdate({ onCheck: checkForUpdates });

  const [isAutoReloading, setIsAutoReloading] = useState(false);

  // Receives the 'kiosk:flush_done' postMessage from the EMR WebView after the
  // persistent-player has finished patching the current position to the server.
  const flushResolverRef = useRef<(() => void) | null>(null);

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const data = event.nativeEvent.data;
    // Try JSON-encoded messages first
    try {
      const msg = JSON.parse(data) as { type?: string };
      if (msg.type === "kiosk:update_check") {
        checkForUpdates();
        return;
      }
    } catch {
      // not JSON — fall through to raw string checks
    }
    if (data === "kiosk:flush_done") {
      flushResolverRef.current?.();
      flushResolverRef.current = null;
    }
  }, [checkForUpdates]);

  const handleAutoReload = useCallback(async (failures: number) => {
    console.warn(`[kiosk] auto-reload triggered after ${failures} consecutive ping failures at ${new Date().toISOString()}`);

    // Ask the EMR persistent-player to flush the current playback position.
    // The player's __kiosk_flushPosition__ function PATCHes the active session
    // and then posts 'kiosk:flush_done' via ReactNativeWebView.postMessage so
    // we can race it against a 2-second timeout. If the network is frozen the
    // timeout wins and we still proceed to reload.
    const flushPromise = new Promise<void>((resolve) => {
      flushResolverRef.current = resolve;
    });

    webViewRef.current?.injectJavaScript(`
      (function() {
        try {
          if (typeof window.__kiosk_flushPosition__ === 'function') {
            window.__kiosk_flushPosition__();
          } else {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('kiosk:flush_done');
          }
        } catch(e) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage('kiosk:flush_done');
        }
      })();
      true;
    `);

    await Promise.race([
      flushPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);

    // Clean up any dangling resolver so a late postMessage doesn't leak.
    flushResolverRef.current = null;

    // Show the overlay first, then yield one tick so React commits the render
    // before the WebView navigation starts.
    setIsAutoReloading(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    webViewRef.current?.reload();
  }, []);

  const connectionStatus = useConnectionStatus(EMR_URL, { onAutoReload: handleAutoReload });
  const bluetoothStatus = useBluetooth();

  // Pull-to-refresh: drag down from the top edge to hard-reload the WebView.
  const PULL_THRESHOLD = 90;
  const MAX_PULL = 130;
  const pullAnim = useRef(new Animated.Value(0)).current;
  const isRefreshingRef = useRef(false);

  const triggerRefresh = useCallback(() => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    Animated.timing(pullAnim, { toValue: MAX_PULL, duration: 80, useNativeDriver: true }).start();
    webViewRef.current?.reload();
    setTimeout(() => {
      Animated.spring(pullAnim, { toValue: 0, useNativeDriver: true }).start(() => {
        isRefreshingRef.current = false;
      });
    }, 900);
  }, [pullAnim]);

  const pullPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.vy > 0,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          pullAnim.setValue(Math.min(g.dy, MAX_PULL));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy >= PULL_THRESHOLD) {
          triggerRefresh();
        } else {
          Animated.spring(pullAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pullAnim, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const handleWebViewError = useCallback(() => setHasError(true), []);
  const handleWebViewLoad = useCallback(() => {
    setHasError(false);
    setIsAutoReloading(false);
  }, []);
  const handleRetry = useCallback(() => {
    setHasError(false);
    webViewRef.current?.reload();
  }, []);

  const handleLockButtonPress = useCallback(() => {
    if (isLocked) {
      setShowPin(true);
    } else {
      lock();
    }
  }, [isLocked, lock]);

  const handlePinSuccess = useCallback(() => {
    setShowPin(false);
    setShowMenu(true);
  }, []);

  const handleUnlock = useCallback(async () => {
    setShowMenu(false);
    await unlock();
  }, [unlock]);

  const handleSignOut = useCallback(() => {
    setShowMenu(false);
    webViewRef.current?.injectJavaScript(`
      (function() {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
          .finally(function() { window.location.href = '/'; });
      })();
      true;
    `);
  }, []);

  const handleOpenSchedule = useCallback(() => {
    setShowMenu(false);
    setTimeout(() => setShowSchedule(true), 200);
  }, []);

  const upToDateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualCheckPendingRef = useRef(false);

  const handleCheckForUpdates = useCallback(() => {
    setUpToDate(false);
    if (upToDateTimerRef.current) clearTimeout(upToDateTimerRef.current);
    manualCheckPendingRef.current = true;
    checkForUpdates();
  }, [checkForUpdates]);

  // Show "Up to date" only when a user-initiated check comes back with no update.
  useEffect(() => {
    if (phase === "no-update" && manualCheckPendingRef.current) {
      manualCheckPendingRef.current = false;
      setUpToDate(true);
      upToDateTimerRef.current = setTimeout(() => setUpToDate(false), 3000);
    } else if (phase !== "checking" && phase !== "no-update") {
      // Any other phase transition (error, downloading, etc.) clears the flag.
      manualCheckPendingRef.current = false;
    }
    return () => {
      if (upToDateTimerRef.current) clearTimeout(upToDateTimerRef.current);
    };
  }, [phase]);

  const handleCloseApp = useCallback(async () => {
    setShowMenu(false);
    await closeApp();
  }, []);

  const versionCode = Constants.expoConfig?.android?.versionCode ?? null;
  const buildTimestamp: string = (Constants.expoConfig?.extra as { buildTimestamp?: string } | undefined)?.buildTimestamp ?? "";
  const injectedJs = `
    (function() {
      window.__KIOSK_MODE__ = true;
      window.__KIOSK_BUILD__ = ${JSON.stringify({ build: versionCode, buildTimestamp })};
      window.__KIOSK_CONNECTION__ = ${JSON.stringify(connectionStatus)};
      window.__KIOSK_BT__ = ${JSON.stringify(bluetoothStatus)};
      document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);
    })();
    true;
  `;

  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      `window.__KIOSK_CONNECTION__ = ${JSON.stringify(connectionStatus)}; true;`
    );
  }, [connectionStatus]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      `window.__KIOSK_BT__ = ${JSON.stringify(bluetoothStatus)}; true;`
    );
  }, [bluetoothStatus]);

  const isUpdating = updateAvailable;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {Platform.OS === "web" ? (
        <View style={styles.webPlaceholder}>
          <Text style={styles.webPlaceholderText}>Kiosk Launcher</Text>
          <Text style={styles.webPlaceholderSub}>
            Android WebView Kiosk App{"\n"}
            Scan the QR code in the Expo Go app to preview on a device.
          </Text>
          <Text style={styles.webPlaceholderUrl}>{EMR_URL}</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: EMR_URL }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          incognito
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          allowsFullscreenVideo
          injectedJavaScriptBeforeContentLoaded={injectedJs}
          onShouldStartLoadWithRequest={() => true}
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color="#4a9eff" />
            </View>
          )}
          geolocationEnabled={false}
          androidLayerType="hardware"
          onLoad={handleWebViewLoad}
          onMessage={handleWebViewMessage}
          onError={handleWebViewError}
          onHttpError={handleWebViewError}
          onPermissionRequest={(request) => {
            const audioResources = request.resources.filter(
              (r) => r === "android.webkit.resource.AUDIO_CAPTURE"
            );
            if (audioResources.length > 0) {
              request.grant(audioResources);
            } else {
              request.deny();
            }
          }}
        />
      )}

      {hasError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Unable to Connect</Text>
          <Text style={styles.errorSub}>
            Could not reach the check-in system.{"\n"}
            Please check the Wi-Fi connection.
          </Text>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {isAutoReloading && (
        <View style={styles.reconnectingOverlay}>
          <ActivityIndicator size="large" color="#4a9eff" />
          <Text style={styles.reconnectingText}>Reconnecting…</Text>
        </View>
      )}

      {!screenOn && (
        <View style={styles.screenOffOverlay} pointerEvents="box-only" />
      )}

      {isUpdating && (
        <View style={styles.updateOverlay}>
          <View style={styles.updateCard}>
            <View style={styles.updateLogo}>
              <Text style={styles.updateLogoText}>cohera</Text>
            </View>
            <Text style={styles.updateTitle}>
              {phase === "installing" ? "Installing update…" : "Update downloading…"}
            </Text>
            <Text style={styles.updateSub}>
              {phase === "installing"
                ? silentInstall
                  ? "The kiosk will restart automatically once installation completes."
                  : "Follow the on-screen prompt to complete the installation."
                : "Please keep the app open. The kiosk will restart automatically."}
            </Text>
            {downloading && (
              <>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${progress}%` as DimensionValue }]}
                  />
                </View>
                <Text style={styles.progressLabel}>{progress}%</Text>
              </>
            )}
            {phase === "installing" && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: "100%" as DimensionValue }]} />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Pull-to-refresh: thin invisible strip at very top intercepts downward drags */}
      <View
        style={styles.pullZone}
        {...pullPanResponder.panHandlers}
        pointerEvents="box-only"
      />
      {/* Animated pull indicator slides down from top edge */}
      <Animated.View
        style={[
          styles.pullIndicator,
          { transform: [{ translateY: Animated.subtract(pullAnim, new Animated.Value(56)) }] },
        ]}
        pointerEvents="none"
      >
        <MaterialCommunityIcons name="refresh" size={22} color="#fff" />
      </Animated.View>

      {/* Lock button — upper right corner */}
      <View style={styles.lockCorner}>
        <View style={styles.lockButtonRow}>
          <Pressable
            style={styles.refreshButton}
            onPress={triggerRefresh}
            android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true, radius: 36 }}
          >
            <MaterialCommunityIcons name="refresh" size={28} color="#ffffff" />
          </Pressable>
          <Pressable
            style={[
              styles.lockButton,
              isLocked ? styles.lockButtonLocked : styles.lockButtonUnlocked,
            ]}
            onPress={handleLockButtonPress}
            android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true, radius: 36 }}
          >
            <MaterialCommunityIcons
              name={isLocked ? "lock" : "lock-open-variant"}
              size={28}
              color="#ffffff"
            />
          </Pressable>
        </View>
        {lastError ? (
          <Text style={styles.lockError} numberOfLines={2}>{lastError}</Text>
        ) : null}
        {relockSecondsLeft !== null ? (
          <Text style={styles.relockCountdown}>Relocking in {relockSecondsLeft}s…</Text>
        ) : null}
      </View>

      <PinModal
        visible={showPin}
        onSuccess={handlePinSuccess}
        onDismiss={() => setShowPin(false)}
      />

      <AdminMenu
        visible={showMenu}
        onUnlock={handleUnlock}
        onSignOut={handleSignOut}
        onSchedule={handleOpenSchedule}
        onCheckForUpdates={handleCheckForUpdates}
        onCloseApp={handleCloseApp}
        onDismiss={() => setShowMenu(false)}
        checking={checking}
        upToDate={upToDate}
        autoUpdateSettings={autoUpdateSettings}
        onAutoUpdateSettingsChange={saveAutoUpdateSettings}
      />

      <ScheduleModal
        visible={showSchedule}
        schedule={schedule}
        onSave={saveSchedule}
        onDismiss={() => setShowSchedule(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a1628",
    position: "relative",
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a1628",
    alignItems: "center",
    justifyContent: "center",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a1628",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
    zIndex: 5,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700" as const,
    textAlign: "center",
  },
  errorSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#4a9eff",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  reconnectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,22,40,0.92)",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    zIndex: 8,
  },
  reconnectingText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 18,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
  },
  screenOffOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 10,
  },
  updateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a1628",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    paddingHorizontal: 32,
  },
  updateCard: {
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
    gap: 16,
  },
  updateLogo: {
    marginBottom: 8,
  },
  updateLogoText: {
    color: "#4a9eff",
    fontSize: 32,
    fontWeight: "700" as const,
    letterSpacing: 2,
    textTransform: "lowercase" as const,
  },
  updateTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700" as const,
    textAlign: "center",
  },
  updateSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: 6,
    backgroundColor: "#4a9eff",
    borderRadius: 3,
  },
  progressLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600" as const,
    marginTop: 4,
  },
  lockCorner: {
    position: "absolute",
    top: 20,
    right: 16,
    zIndex: 50,
    alignItems: "flex-end",
    gap: 6,
  },
  lockButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  lockButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  lockButtonLocked: {
    backgroundColor: "#1a0d0d",
    borderColor: "#f87171",
    shadowColor: "#f87171",
  },
  lockButtonUnlocked: {
    backgroundColor: "#0d1a0d",
    borderColor: "#4ade80",
    shadowColor: "#4ade80",
  },
  lockError: {
    color: "#f87171",
    fontSize: 10,
    maxWidth: 120,
    lineHeight: 13,
  },
  relockCountdown: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    maxWidth: 120,
    lineHeight: 13,
  },
  pullZone: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 98,
    backgroundColor: "transparent",
  },
  pullIndicator: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    zIndex: 97,
    backgroundColor: "rgba(74,158,255,0.85)",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  webPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  webPlaceholderText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700" as const,
    textAlign: "center",
  },
  webPlaceholderSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  webPlaceholderUrl: {
    color: "#4a9eff",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
});
