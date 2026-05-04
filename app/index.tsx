import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useScreenSchedule } from "@/hooks/useScreenSchedule";

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
