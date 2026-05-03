/**
 * AdminMenu
 *
 * Shown after a successful PIN entry.
 * Lets staff choose between exiting kiosk mode, opening schedule settings,
 * or installing an available app update.
 */

import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  visible: boolean;
  onExitKiosk: () => void;
  onSchedule: () => void;
  onDismiss: () => void;
  apkUpdateAvailable?: boolean;
  apkLatestBuild?: number;
  apkDownloading?: boolean;
  apkDownloadProgress?: number;
  apkError?: string | null;
  onInstallUpdate?: () => void;
}

export function AdminMenu({
  visible,
  onExitKiosk,
  onSchedule,
  onDismiss,
  apkUpdateAvailable = false,
  apkLatestBuild = 0,
  apkDownloading = false,
  apkDownloadProgress = 0,
  apkError = null,
  onInstallUpdate,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Admin Options</Text>

          <Pressable style={s.item} onPress={onSchedule}>
            <Text style={s.icon}>🕐</Text>
            <View style={s.itemText}>
              <Text style={s.itemTitle}>Screen Schedule</Text>
              <Text style={s.itemSub}>Set daily on/off times for the display</Text>
            </View>
          </Pressable>

          {apkUpdateAvailable && (
            <Pressable
              style={[s.item, s.updateItem, apkDownloading && s.updateItemDisabled]}
              onPress={apkDownloading ? undefined : onInstallUpdate}
              disabled={apkDownloading}
            >
              <Text style={s.icon}>📦</Text>
              <View style={s.itemText}>
                <Text style={[s.itemTitle, s.updateTitle]}>
                  {apkDownloading ? "Downloading…" : `Update Available (build ${apkLatestBuild})`}
                </Text>
                {apkDownloading ? (
                  <View style={s.progressRow}>
                    <View style={s.progressTrack}>
                      <View style={[s.progressFill, { width: `${Math.round(apkDownloadProgress * 100)}%` }]} />
                    </View>
                    <Text style={s.progressPct}>{Math.round(apkDownloadProgress * 100)}%</Text>
                  </View>
                ) : (
                  <Text style={s.itemSub}>Tap to download and install</Text>
                )}
                {apkError != null && <Text style={s.errorText}>{apkError}</Text>}
              </View>
              {apkDownloading && (
                <ActivityIndicator size="small" color="#4ade80" style={s.spinner} />
              )}
            </Pressable>
          )}

          <Pressable style={[s.item, s.exitItem]} onPress={onExitKiosk}>
            <Text style={s.icon}>🔓</Text>
            <View style={s.itemText}>
              <Text style={[s.itemTitle, s.exitTitle]}>Exit Kiosk Mode</Text>
              <Text style={s.itemSub}>Unlock the device and return to Android</Text>
            </View>
          </Pressable>

          <Pressable style={s.cancel} onPress={onDismiss}>
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#1a2540",
    borderRadius: 20,
    padding: 24,
    width: 320,
    alignItems: "stretch",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700" as const,
    textAlign: "center",
    marginBottom: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  exitItem: {
    backgroundColor: "rgba(255,60,60,0.12)",
  },
  updateItem: {
    backgroundColor: "rgba(74,222,128,0.10)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
  },
  updateItemDisabled: {
    opacity: 0.8,
  },
  icon: {
    fontSize: 24,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  exitTitle: {
    color: "#ff7070",
  },
  updateTitle: {
    color: "#4ade80",
  },
  itemSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#4ade80",
    borderRadius: 2,
  },
  progressPct: {
    color: "#4ade80",
    fontSize: 11,
    fontWeight: "600" as const,
    minWidth: 32,
    textAlign: "right",
  },
  errorText: {
    color: "#ff7070",
    fontSize: 11,
    marginTop: 4,
  },
  spinner: {
    marginLeft: 4,
  },
  cancel: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
});
