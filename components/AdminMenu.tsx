/**
 * AdminMenu
 *
 * Shown after a successful PIN entry.
 * Lets staff choose between admin settings, unlocking the kiosk,
 * or triggering an app update check.
 */

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  visible: boolean;
  onUnlockKiosk: () => void;
  onSchedule: () => void;
  onDismiss: () => void;
  onCheckForUpdates: () => void;
  onSignOut: () => void;
}

export function AdminMenu({
  visible,
  onUnlockKiosk,
  onSchedule,
  onDismiss,
  onCheckForUpdates,
  onSignOut,
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
            <Text style={s.icon}>⚙️</Text>
            <View style={s.itemText}>
              <Text style={s.itemTitle}>Admin Settings</Text>
              <Text style={s.itemSub}>Screen schedule and app update options</Text>
            </View>
          </Pressable>

          <Pressable
            style={s.item}
            onPress={() => {
              onDismiss();
              onCheckForUpdates();
            }}
          >
            <Text style={s.icon}>📦</Text>
            <View style={s.itemText}>
              <Text style={s.itemTitle}>Check for Updates</Text>
              <Text style={s.itemSub}>Download and install latest APK now</Text>
            </View>
          </Pressable>

          <Pressable style={[s.item, s.unlockItem]} onPress={onUnlockKiosk}>
            <Text style={s.icon}>🔓</Text>
            <View style={s.itemText}>
              <Text style={[s.itemTitle, s.unlockTitle]}>Unlock Kiosk</Text>
              <Text style={s.itemSub}>Exit lock-task mode — tablet can be used freely</Text>
            </View>
          </Pressable>

          <Pressable style={[s.item, s.signOutItem]} onPress={onSignOut}>
            <Text style={s.icon}>🚪</Text>
            <View style={s.itemText}>
              <Text style={[s.itemTitle, s.signOutTitle]}>Sign Out</Text>
              <Text style={s.itemSub}>Log out of the kiosk session</Text>
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
  unlockItem: {
    backgroundColor: "rgba(255,60,60,0.12)",
  },
  signOutItem: {
    backgroundColor: "rgba(255,165,0,0.10)",
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
  unlockTitle: {
    color: "#ff7070",
  },
  signOutTitle: {
    color: "#ffb347",
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
