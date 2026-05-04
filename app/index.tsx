import { useKeepAwake } from "expo-keep-awake";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { AdminMenu } from "@/components/AdminMenu";
import { PinModal } from "@/components/PinModal";
import { ScheduleModal } from "@/components/ScheduleModal";
import { useScreenSchedule } from "@/hooks/useScreenSchedule";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useBuildInfo } from "@/hooks/useBuildInfo";
import { startLock, stopLock } from "@/modules/LockTask";

const EMR_URL =
  process.env.EXPO_PUBLIC_EMR_URL ?? "https://health-record-hub-slinuw.replit.app";

/**
 * PIN that staff must enter to access admin options.
 * Set EXPO_PUBLIC_KIOSK_EXIT_PIN at build time.
 * Default is "1561".
 */
const EXIT_PIN = process.env.EXPO_PUBLIC_KIOSK_EXIT_PIN ?? "1561";

const AUTO_LOCK_DELAY_MS = 2 * 60 * 1000;

export default function KioskScreen() {
  useKeepAwake();

  const { isChecking, isUpdating, updateProgress, updateError, latestBuild, checkNow } =
    useAppUpdate();
  const buildInfo = useBuildInfo();

  const webViewRef = useRef<WebView>(null);
  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isKioskLocked, setIsKioskLocked] = useState(true);

  // Modal visibility
  const [pinVisible, setPinVisible] = useState(false);
  const [adminVisible, setAdminVisible] = useState(false);
  const [scheduleVisible, setScheduleVisible] = useState(false);

  // Hard-refresh callback passed to the scheduler
  const handleScheduledRefresh = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  // Screen schedule
  const { schedule, screenOn, saveSchedule } = useScreenSchedule({
    onRefresh: handleScheduledRefresh,
  });

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("hidden").catch(() => {});
      NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
      startLock();
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
      }
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  // Clean up auto-lock timer on unmount
  useEffect(() => {
    return () => {
      if (autoLockTimer.current) {
        clearTimeout(autoLockTimer.current);
      }
    };
  }, []);

  const onNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      setCanGoBack(navState.canGoBack);
    },
    []
  );

  const handleWebViewError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleWebViewLoad = useCallback(() => {
    setHasError(false);
    setIsLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  // Re-engage lock-task mode and update state
  const lockKiosk = useCallback(async () => {
    if (autoLockTimer.current) {
      clearTimeout(autoLockTimer.current);
      autoLockTimer.current = null;
    }
    await startLock();
    NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
    setIsKioskLocked(true);
  }, []);

  // Button tap: lock icon when locked (open PIN), unlock icon when unlocked (re-lock)
  const handleLockButtonPress = useCallback(() => {
    if (isKioskLocked) {
      setPinVisible(true);
    } else {
      lockKiosk();
    }
  }, [isKioskLocked, lockKiosk]);

  // Correct PIN → admin menu
  const handlePinSuccess = useCallback(() => {
    setPinVisible(false);
    setAdminVisible(true);
  }, []);

  const handlePinDismiss = useCallback(() => setPinVisible(false), []);

  // Admin menu actions
  const handleUnlockKiosk = useCallback(async () => {
    setAdminVisible(false);
    await stopLock();
    NavigationBar.setVisibilityAsync("visible").catch(() => {});
    NavigationBar.setBehaviorAsync("inset-swipe").catch(() => {});
    setIsKioskLocked(false);
    // Auto-lock after 2 minutes of unlocked use
    autoLockTimer.current = setTimeout(() => {
      lockKiosk();
    }, AUTO_LOCK_DELAY_MS);
  }, [lockKiosk]);

  const handleOpenSchedule = useCallback(() => {
    setAdminVisible(false);
    setScheduleVisible(true);
  }, []);

  const handleAdminDismiss = useCallback(() => setAdminVisible(false), []);

  // Schedule modal
  const handleScheduleSave = useCallback(
    async (s: Parameters<typeof saveSchedule>[0]) => {
      await saveSchedule(s);
      setScheduleVisible(false);
    },
    [saveSchedule]
  );

  const handleScheduleDismiss = useCallback(
    () => setScheduleVisible(false),
    []
  );

  // Injected *before* content loads so __KIOSK_MODE__ is always present when
  // React mounts in the WebView. __KIOSK_BUILD__ is omitted here when buildInfo
  // hasn't resolved yet — it is pushed in via injectJavaScript() below instead.
  const injectedJsBeforeLoad = buildInfo != null
    ? `(function(){window.__KIOSK_MODE__=true;window.__KIOSK_BUILD__=${JSON.stringify(buildInfo)};})();true;`
    : `(function(){window.__KIOSK_MODE__=true;})();true;`;

  // Injected *after* load for anything that requires the DOM to exist first.
  const injectedJs = `
    (function() {
      document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);
    })();
    true;
  `;

  // Once buildInfo resolves from AsyncStorage, push it into the live WebView
  // so the login page polling can pick it up even if the page was already loaded.
  useEffect(() => {
    if (buildInfo == null) return;
    webViewRef.current?.injectJavaScript(
      `window.__KIOSK_BUILD__=${JSON.stringify(buildInfo)};true;`
    );
  }, [buildInfo]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Web platform: show a placeholder instead of the WebView (WebView is Android-only) */}
      {Platform.OS === "web" ? (
        <View style={styles.webPlaceholder}>
          <Text style={styles.webPlaceholderText}>Kiosk Launcher</Text>
          <Text style={styles.webPlaceholderSub}>
            Android WebView Kiosk App{"\n"}
            Scan the QR code in the Expo Go app to preview on a device.
          </Text>
          <Text style={styles.webPlaceholderUrl}>{EMR_URL}</Text>
        </View>
      ) : /* Checking splash — shown instead of the WebView while the launch update check runs */
      isChecking ? (
        <View style={styles.checkingOverlay}>
          <Text style={styles.checkingIcon}>🏥</Text>
          <Text style={styles.checkingTitle}>Cohera Kiosk</Text>
          <Text style={styles.checkingSub}>Checking for updates…</Text>
          {buildInfo != null && (
            <Text style={styles.checkingVersion}>
              Build {buildInfo.build} · Updated {buildInfo.installedAt}
            </Text>
          )}
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
          onNavigationStateChange={onNavigationStateChange}
          injectedJavaScriptBeforeContentLoaded={injectedJsBeforeLoad}
          injectedJavaScript={injectedJs}
          onShouldStartLoadWithRequest={() => true}
          setSupportMultipleWindows={false}
          startInLoadingState
          geolocationEnabled={false}
          androidLayerType="hardware"
          onLoad={handleWebViewLoad}
          onError={handleWebViewError}
          onHttpError={handleWebViewError}
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

      {/* Black overlay when schedule says screen should be off. */}
      {!screenOn && (
        <View style={styles.screenOffOverlay} pointerEvents="box-only" />
      )}

      {/* Full-screen update overlay — non-dismissible */}
      {isUpdating && (
        <View style={styles.updateOverlay} pointerEvents="box-only">
          <Text style={styles.updateIcon}>📦</Text>
          <Text style={styles.updateTitle}>
            {updateProgress >= 1 ? "Installing…" : "Downloading Update"}
          </Text>
          <Text style={styles.updateBuild}>
            {latestBuild > 0 ? `Build ${latestBuild}` : "Downloading…"}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(updateProgress * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressPct}>
            {Math.round(updateProgress * 100)}%
          </Text>
          {updateError != null && (
            <Text style={styles.updateError}>{updateError}</Text>
          )}
          <Text style={styles.updateSub}>
            Please do not turn off the tablet.
          </Text>
        </View>
      )}

      {/* Lock/unlock button in the top-right corner */}
      <Pressable
        style={[styles.lockButton, !isKioskLocked && styles.lockButtonUnlocked]}
        onPress={handleLockButtonPress}
        testID="lock-button"
      >
        <Text style={styles.lockButtonIcon}>{isKioskLocked ? "🔒" : "🔓"}</Text>
      </Pressable>

      <PinModal
        visible={pinVisible}
        correctPin={EXIT_PIN}
        onSuccess={handlePinSuccess}
        onDismiss={handlePinDismiss}
      />

      <AdminMenu
        visible={adminVisible}
        onUnlockKiosk={handleUnlockKiosk}
        onSchedule={handleOpenSchedule}
        onDismiss={handleAdminDismiss}
        onCheckForUpdates={checkNow}
      />

      <ScheduleModal
        visible={scheduleVisible}
        schedule={schedule}
        onSave={handleScheduleSave}
        onDismiss={handleScheduleDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a1628",
  },
  webview: {
    flex: 1,
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
  screenOffOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 10,
  },
  checkingOverlay: {
    flex: 1,
    backgroundColor: "#0a1628",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  checkingIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  checkingTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700" as const,
    textAlign: "center",
  },
  checkingSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 15,
    textAlign: "center",
  },
  checkingVersion: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    fontVariant: ["tabular-nums"],
  },
  updateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a1628",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    gap: 12,
    zIndex: 20,
  },
  updateIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  updateTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700" as const,
    textAlign: "center",
  },
  updateBuild: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: "#4a9eff",
    borderRadius: 3,
  },
  progressPct: {
    color: "#4a9eff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  updateError: {
    color: "#ff7070",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  updateSub: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  lockButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  lockButtonUnlocked: {
    backgroundColor: "rgba(74,222,128,0.20)",
  },
  lockButtonIcon: {
    fontSize: 18,
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
