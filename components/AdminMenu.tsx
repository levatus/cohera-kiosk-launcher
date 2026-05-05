import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  visible: boolean;
  onUnlock: () => void;
  onSignOut: () => void;
  onSchedule: () => void;
  onDismiss: () => void;
}

interface MenuItemProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, sublabel, onPress, danger }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={danger ? "#f87171" : "#4a9eff"}
        />
      </View>
      <View style={styles.itemText}>
        <Text style={[styles.itemLabel, danger && styles.itemLabelDanger]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.itemSublabel}>{sublabel}</Text>
        ) : null}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color="rgba(255,255,255,0.2)"
      />
    </Pressable>
  );
}

export function AdminMenu({
  visible,
  onUnlock,
  onSignOut,
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
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Admin</Text>

          <View style={styles.menu}>
            <MenuItem
              icon="lock-open-variant"
              label="Unlock"
              sublabel="Exit kiosk lock task mode"
              onPress={onUnlock}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="logout"
              label="Sign Out"
              sublabel="Reload and clear session"
              onPress={onSignOut}
              danger
            />
            <View style={styles.divider} />
            <MenuItem
              icon="calendar-clock"
              label="Screen Schedule"
              sublabel="Display hours & daily refresh"
              onPress={onSchedule}
            />
          </View>

          <Pressable style={styles.cancelBtn} onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 24,
    width: 340,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700" as const,
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  menu: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  itemPressed: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(74,158,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapDanger: {
    backgroundColor: "rgba(248,113,113,0.12)",
  },
  itemText: {
    flex: 1,
  },
  itemLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600" as const,
  },
  itemLabelDanger: {
    color: "#f87171",
  },
  itemSublabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 16,
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  cancelText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    fontWeight: "500" as const,
  },
});
