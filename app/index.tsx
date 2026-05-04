import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useScreenSchedule } from "@/hooks/useScreenSchedule";
import { useAppUpdate } from "@/hooks/useAppUpdate";

const EMR_URL =
  process.env.EXPO_PUBLIC_EMR_URL ?? "https://health-record-hub-slinuw.replit.app";

export default function KioskScreen() {
  useKeepAwake();

  const webViewRef = useRef<WebView>(null);
  const [hasError, setHasError] = useState(false);

  const handleScheduledRefresh = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  const { screenOn } = useScreenSchedule({
    onRefresh: handleScheduledRefresh,
  });

  const { phase, progress, error: updateError } = useAppUpdate();

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

  const injectedJs = `
    (function() {
      window.__KIOSK_MODE__ = true;
      document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);
    })();
    true;
  `;

  const isUpdating =
    phase === "downloading" || phase === "installing";

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

            {phase === "downloading" && (
              <>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress}%` as unknown as number },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>{progress}%</Text>
              </>
            )}

            {phase === "installing" && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: "100%" as unknown as number }]} />
              </View>
            )}
          </View>
        </View>
      )}

      {phase === "error" && updateError && (
        <View style={styles.updateErrorBanner}>
          <Text style={styles.updateErrorText} numberOfLines={2}>
            Update check failed — {updateError}
          </Text>
        </View>
      )}
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
