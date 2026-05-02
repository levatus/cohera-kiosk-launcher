import { useKeepAwake } from "expo-keep-awake";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { AdminMenu } from "@/components/AdminMenu";
import { LongPressEscapeButton } from "@/components/LongPressEscapeButton";
import { PinModal } from "@/components/PinModal";
import { ScheduleModal } from "@/components/ScheduleModal";
import { useScreenSchedule } from "@/hooks/useScreenSchedule";
import { startLock, stopLock } from "@/modules/LockTask";

const EMR_URL =
  process.env.EXPO_PUBLIC_EMR_URL ?? "https://emrreplit.replit.app";

/**
 * PIN that staff must enter to access admin options.
 * Set EXPO_PUBLIC_KIOSK_EXIT_PIN at build time.
 * Default is "1234" — change before deploying.
 */
const EXIT_PIN = process.env.EXPO_PUBLIC_KIOSK_EXIT_PIN ?? "1234";

export default function KioskScreen() {
  useKeepAwake();

  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

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

  const onNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      setCanGoBack(navState.canGoBack);
    },
    []
  );

  // 5-second hold → PIN prompt
  const handleEscapeHold = useCallback(() => {
    setPinVisible(true);
  }, []);

  // Correct PIN → admin menu
  const handlePinSuccess = useCallback(() => {
    setPinVisible(false);
    setAdminVisible(true);
  }, []);

  const handlePinDismiss = useCallback(() => setPinVisible(false), []);

  // Admin menu actions
  const handleExitKiosk = useCallback(async () => {
    setAdminVisible(false);
    await stopLock();
  }, []);

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

  const injectedJs = `
    (function() {
      document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);
      window.__KIOSK_MODE__ = true;
    })();
    true;
  `;

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.webPlaceholder}>
          <Text style={styles.webPlaceholderText}>Kiosk Launcher</Text>
          <Text style={styles.webPlaceholderSub}>
            Android WebView Kiosk App{"\n"}
            Scan the QR code in the Expo Go app to preview on a device.
          </Text>
          <Text style={styles.webPlaceholderUrl}>{EMR_URL}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <WebView
        ref={webViewRef}
        source={{ uri: EMR_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        allowsFullscreenVideo
        onNavigationStateChange={onNavigationStateChange}
        injectedJavaScript={injectedJs}
        onShouldStartLoadWithRequest={() => true}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled
        startInLoadingState={false}
        geolocationEnabled={false}
        androidLayerType="hardware"
      />

      {/* Black overlay when schedule says screen should be off.
          Shown as a fallback when DevicePolicyManager.lockNow() is
          not available (app is not Device Admin). */}
      {!screenOn && (
        <View style={styles.screenOffOverlay} pointerEvents="box-only" />
      )}

      <LongPressEscapeButton onEscape={handleEscapeHold} />

      <PinModal
        visible={pinVisible}
        correctPin={EXIT_PIN}
        onSuccess={handlePinSuccess}
        onDismiss={handlePinDismiss}
      />

      <AdminMenu
        visible={adminVisible}
        onExitKiosk={handleExitKiosk}
        onSchedule={handleOpenSchedule}
        onDismiss={handleAdminDismiss}
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
  screenOffOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 10,
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
