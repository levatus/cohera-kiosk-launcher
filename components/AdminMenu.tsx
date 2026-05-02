/**
 * AdminMenu
 *
 * Shown after a successful PIN entry.
 * Lets staff choose between exiting kiosk mode or opening schedule settings.
 */

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  visible: boolean;
  onExitKiosk: () => void;
  onSchedule: () => void;
  onDismiss: () => void;
}

export function AdminMenu({
  visible,
  onExitKiosk,
  onSchedule,
  onDismiss,
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
  itemSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
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
