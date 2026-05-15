import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { AutoUpdateSettings, formatNextCheckTime } from "@/hooks/useAutoUpdate";

interface Props {
  visible: boolean;
  onUnlock: () => void;
  onSignOut: () => void;
  onSchedule: () => void;
  onCheckForUpdates: () => void;
  onCloseApp: () => void;
  onDismiss: () => void;
  /** True while a GitHub release check is in flight. */
  checking?: boolean;
  /** Shown briefly after a check completes with no new version. */
  upToDate?: boolean;
  /** Current auto-update settings. */
  autoUpdateSettings: AutoUpdateSettings;
  /** Called when the user saves auto-update settings. */
  onAutoUpdateSettingsChange: (next: AutoUpdateSettings) => void;
}

interface MenuItemProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  rightElement?: React.ReactNode;
}

function MenuItem({ icon, label, sublabel, onPress, danger, disabled, rightElement }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && !disabled && styles.itemPressed, disabled && styles.itemDisabled]}
      onPress={disabled ? undefined : onPress}
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
      {rightElement ?? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color="rgba(255,255,255,0.2)"
        />
      )}
    </Pressable>
  );
}

/** Clamps a value into [min, max] with wrap-around. */
function wrap(value: number, min: number, max: number): number {
  if (value < min) return max;
  if (value > max) return min;
  return value;
}

export function AdminMenu({
  visible,
  onUnlock,
  onSignOut,
  onSchedule,
  onCheckForUpdates,
  onCloseApp,
  onDismiss,
  checking = false,
  upToDate = false,
  autoUpdateSettings,
  onAutoUpdateSettingsChange,
}: Props) {
  // Local draft of auto-update settings so changes feel immediate even before
  // the parent async-persists them.
  const [draft, setDraft] = useState<AutoUpdateSettings>(autoUpdateSettings);

  // Sync draft when the prop changes (e.g. on open).
  React.useEffect(() => {
    setDraft(autoUpdateSettings);
  }, [autoUpdateSettings, visible]);

  const updateDraft = (patch: Partial<AutoUpdateSettings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onAutoUpdateSettingsChange(next);
  };

  const isAM = draft.hour < 12;
  const display12 = draft.hour % 12 === 0 ? 12 : draft.hour % 12;

  const incrementHour = () => {
    updateDraft({ hour: wrap(draft.hour + 1, 0, 23) });
  };
  const decrementHour = () => {
    updateDraft({ hour: wrap(draft.hour - 1, 0, 23) });
  };
  const toggleAmPm = () => {
    updateDraft({ hour: draft.hour < 12 ? draft.hour + 12 : draft.hour - 12 });
  };

  const nextCheckLabel = formatNextCheckTime(draft);

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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
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
              <View style={styles.divider} />
              <MenuItem
                icon="download-circle-outline"
                label={checking ? "Checking…" : upToDate ? "Up to date" : "Check for Updates"}
                sublabel="Compare against latest GitHub release"
                onPress={onCheckForUpdates}
                disabled={checking}
                rightElement={
                  checking ? (
                    <ActivityIndicator size="small" color="#4a9eff" />
                  ) : upToDate ? (
                    <MaterialCommunityIcons name="check-circle-outline" size={18} color="#4ade80" />
                  ) : (
                    <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.2)" />
                  )
                }
              />
              <View style={styles.divider} />

              {/* ── Auto Updates section ─────────────────────────────── */}
              <View style={styles.autoUpdateSection}>
                <View style={styles.autoUpdateHeader}>
                  <View style={[styles.iconWrap]}>
                    <MaterialCommunityIcons
                      name="update"
                      size={22}
                      color="#4a9eff"
                    />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemLabel}>Auto Updates</Text>
                    <Text style={styles.itemSublabel}>Daily scheduled check</Text>
                  </View>
                  <Switch
                    value={draft.enabled}
                    onValueChange={(v) => updateDraft({ enabled: v })}
                    trackColor={{ false: "rgba(255,255,255,0.12)", true: "rgba(74,158,255,0.5)" }}
                    thumbColor={draft.enabled ? "#4a9eff" : "rgba(255,255,255,0.4)"}
                    ios_backgroundColor="rgba(255,255,255,0.12)"
                  />
                </View>

                {draft.enabled && (
                  <View style={styles.timePicker}>
                    <Text style={styles.timePickerLabel}>Check time</Text>
                    <View style={styles.timePickerRow}>
                      {/* Hour stepper */}
                      <Pressable
                        style={styles.timeBtn}
                        onPress={decrementHour}
                        android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true, radius: 20 }}
                      >
                        <MaterialCommunityIcons name="minus" size={16} color="#4a9eff" />
                      </Pressable>
                      <View style={styles.timeValue}>
                        <Text style={styles.timeValueText}>{display12}</Text>
                      </View>
                      <Pressable
                        style={styles.timeBtn}
                        onPress={incrementHour}
                        android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true, radius: 20 }}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color="#4a9eff" />
                      </Pressable>

                      <Text style={styles.timeSep}>:</Text>

                      {/* Minute stepper — 5-minute increments */}
                      <Pressable
                        style={styles.timeBtn}
                        onPress={() => updateDraft({ minute: wrap(draft.minute - 5, 0, 55) })}
                        android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true, radius: 20 }}
                      >
                        <MaterialCommunityIcons name="minus" size={16} color="#4a9eff" />
                      </Pressable>
                      <View style={styles.timeValue}>
                        <Text style={styles.timeValueText}>
                          {String(draft.minute).padStart(2, "0")}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.timeBtn}
                        onPress={() => updateDraft({ minute: wrap(draft.minute + 5, 0, 55) })}
                        android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true, radius: 20 }}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color="#4a9eff" />
                      </Pressable>

                      {/* AM / PM toggle */}
                      <Pressable
                        style={styles.amPmBtn}
                        onPress={toggleAmPm}
                        android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: false }}
                      >
                        <Text style={styles.amPmText}>{isAM ? "AM" : "PM"}</Text>
                      </Pressable>
                    </View>

                    {nextCheckLabel ? (
                      <Text style={styles.nextCheckLabel}>
                        Next check: {nextCheckLabel}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>

              <View style={styles.divider} />
              <MenuItem
                icon="power"
                label="Close App"
                sublabel="Stop kiosk mode and exit"
                onPress={onCloseApp}
                danger
              />
            </View>
          </ScrollView>

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
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  scrollContent: {
    flexGrow: 1,
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
  itemDisabled: {
    opacity: 0.6,
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

  // ── Auto Updates ─────────────────────────────────────────────────────────
  autoUpdateSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  autoUpdateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  timePicker: {
    marginLeft: 54,
    gap: 8,
  },
  timePickerLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  timePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(74,158,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  timeValue: {
    width: 36,
    alignItems: "center",
  },
  timeValueText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700" as const,
  },
  timeSep: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  amPmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(74,158,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(74,158,255,0.3)",
  },
  amPmText: {
    color: "#4a9eff",
    fontSize: 13,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  nextCheckLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginTop: 6,
  },
});
