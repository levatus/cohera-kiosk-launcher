import Constants from "expo-constants";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useRef, useState } from "react";
import {
  DimensionValue,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useScreenSchedule } from "@/hooks/useScreenSchedule";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useKioskLock } from "@/hooks/useKioskLock";

const EMR_URL =
  process.env.EXPO_PUBLIC_EMR_URL ?? "https://health-record-hub-slinuw.replit.app";

export default function KioskScreen() {
  useKeepAwake();

  const webViewRef = useRef<WebView>(null);
  const [hasError, setHasError] = useState(false);
  const { isLocked, lastError, toggle: toggleLock } = useKioskLock();

  const handleScheduledRefresh = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  const { screenOn } = useScreenSchedule({
    onRefresh: handleScheduledRefresh,
  });

  const {
    updateAvailable,
    downloading,
    progress,
    phase,
  } = useAppUpdate();

  const handleWebViewError = useCallback(() => {
    setHasError(true);
  }, []);

  const handleWebViewLoad = useCallback(() => {
    setHasError(false);
  }, []);

  const handleRetry = useCallback(() => {
    setHasError(false);
    webViewRef.current?.reload();
  }, []);

  const versionCode = Constants.expoConfig?.android?.versionCode ?? null;
  const injectedJs = `
    (function() {
      window.__KIOSK_MODE__ = true;
      window.__KIOSK_BUILD__ = ${JSON.stringify({ build: versionCode })};
      document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);
    })();
    true;
  `;

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
              {phase === "installing"
                ? "Installing update…"
                : "Update downloading…"}
            </Text>

            <Text style={styles.updateSub}>
              {phase === "installing"
                ? "Follow the on-screen prompt to complete the installation."
                : `Please keep the app open. The kiosk will restart automatically.`}
            </Text>

            {downloading && (
              <>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress}%` as DimensionValue },
                    ]}
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

      <View style={styles.lockCorner}>
        <Pressable
          style={[styles.lockButton, isLocked ? styles.lockButtonLocked : styles.lockButtonUnlocked]}
          onPress={toggleLock}
          android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true, radius: 36 }}
        >
          <Text style={styles.lockButtonText}>{isLocked ? "Lock" : "Unlock"}</Text>
        </Pressable>
        {lastError ? (
          <Text style={styles.lockError} numberOfLines={2}>{lastError}</Text>
        ) : null}
      </View>
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

  updateErrorBanner: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: "rgba(220,60,60,0.85)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 30,
  },
  updateErrorText: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
  },

  lockCorner: {
    position: "absolute",
    bottom: 20,
    left: 16,
    zIndex: 50,
    alignItems: "flex-start",
    gap: 6,
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
  lockButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  lockError: {
    color: "#f87171",
    fontSize: 10,
    maxWidth: 120,
    lineHeight: 13,
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
