/**
 * ScheduleModal
 *
 * Lets staff set the screen on/off schedule and daily refresh time.
 * Accessible only after the admin PIN is entered correctly.
 */

import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { DEFAULT_SCHEDULE, ScreenSchedule } from "@/hooks/useScreenSchedule";

interface Props {
  visible: boolean;
  schedule: ScreenSchedule;
  onSave: (s: ScreenSchedule) => void;
  onDismiss: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function TimePicker({
  label,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  label: string;
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}) {
  return (
    <View style={tp.row}>
      <Text style={tp.label}>{label}</Text>
      <View style={tp.spinners}>
        <Spinner
          value={hour}
          min={0}
          max={23}
          onChange={onHourChange}
          format={(v) => pad(v)}
        />
        <Text style={tp.colon}>:</Text>
        <Spinner
          value={minute}
          min={0}
          max={59}
          step={5}
          onChange={onMinuteChange}
          format={(v) => pad(v)}
        />
      </View>
    </View>
  );
}

function Spinner({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
}) {
  const inc = () => {
    const next = value + step;
    onChange(next > max ? min : next);
  };
  const dec = () => {
    const next = value - step;
    onChange(next < min ? max - ((max - min + 1) % step || step) + step : next);
  };

  return (
    <View style={sp.col}>
      <Pressable style={sp.btn} onPress={inc}>
        <Text style={sp.arrow}>▲</Text>
      </Pressable>
      <Text style={sp.value}>{format(value)}</Text>
      <Pressable style={sp.btn} onPress={dec}>
        <Text style={sp.arrow}>▼</Text>
      </Pressable>
    </View>
  );
}

export function ScheduleModal({ visible, schedule, onSave, onDismiss }: Props) {
  const [draft, setDraft] = useState<ScreenSchedule>(schedule);

  // Re-sync draft when the modal opens with a fresh schedule prop
  const prevVisible = React.useRef(false);
  if (visible && !prevVisible.current) {
    prevVisible.current = true;
    if (JSON.stringify(draft) !== JSON.stringify(schedule)) {
      setDraft({ ...DEFAULT_SCHEDULE, ...schedule });
    }
  }
  if (!visible) prevVisible.current = false;

  const set = (patch: Partial<ScreenSchedule>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const handleSave = () => {
    onSave(draft);
    onDismiss();
  };

  const handleReset = () => {
    setDraft(DEFAULT_SCHEDULE);
  };

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
          <Text style={s.title}>Screen Schedule</Text>
          <Text style={s.subtitle}>
            Configure daily display times and automatic refresh
          </Text>

          {/* ── Screen on/off ── */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>Display hours</Text>
            <Switch
              value={draft.enabled}
              onValueChange={(v) => set({ enabled: v })}
              trackColor={{ false: "rgba(255,255,255,0.15)", true: "#4a9eff" }}
              thumbColor="#fff"
            />
          </View>

          <View style={[s.timers, !draft.enabled && s.disabled]}>
            <TimePicker
              label="Screen ON"
              hour={draft.onHour}
              minute={draft.onMinute}
              onHourChange={(onHour) => set({ onHour })}
              onMinuteChange={(onMinute) => set({ onMinute })}
            />
            <View style={s.divider} />
            <TimePicker
              label="Screen OFF"
              hour={draft.offHour}
              minute={draft.offMinute}
              onHourChange={(offHour) => set({ offHour })}
              onMinuteChange={(offMinute) => set({ offMinute })}
            />
          </View>

          {draft.enabled && (
            <Text style={s.hint}>
              Screen on {pad(draft.onHour)}:{pad(draft.onMinute)} –{" "}
              {pad(draft.offHour)}:{pad(draft.offMinute)} daily
            </Text>
          )}

          {/* ── Daily refresh ── */}
          <View style={[s.sectionHeader, s.sectionHeaderTop]}>
            <Text style={s.sectionLabel}>Daily page refresh</Text>
            <Switch
              value={draft.refreshEnabled}
              onValueChange={(v) => set({ refreshEnabled: v })}
              trackColor={{ false: "rgba(255,255,255,0.15)", true: "#4a9eff" }}
              thumbColor="#fff"
            />
          </View>

          <View style={[s.timers, !draft.refreshEnabled && s.disabled]}>
            <TimePicker
              label="Refresh at"
              hour={draft.refreshHour}
              minute={draft.refreshMinute}
              onHourChange={(refreshHour) => set({ refreshHour })}
              onMinuteChange={(refreshMinute) => set({ refreshMinute })}
            />
          </View>

          {draft.refreshEnabled && (
            <Text style={s.hint}>
              Hard refresh every day at{" "}
              {pad(draft.refreshHour)}:{pad(draft.refreshMinute)}
            </Text>
          )}

          <View style={s.actions}>
            <Pressable style={s.btnSecondary} onPress={handleReset}>
              <Text style={s.btnSecondaryText}>Reset</Text>
            </Pressable>
            <Pressable style={s.btnSecondary} onPress={onDismiss}>
              <Text style={s.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={s.btnPrimary} onPress={handleSave}>
              <Text style={s.btnPrimaryText}>Save</Text>
            </Pressable>
          </View>
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
    padding: 28,
    width: 340,
    alignItems: "stretch",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700" as const,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionHeaderTop: {
    marginTop: 20,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  timers: {
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 8,
  },
  disabled: {
    opacity: 0.35,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 4,
  },
  hint: {
    color: "#4a9eff",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 24,
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: "#4a9eff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  btnPrimaryText: {
    color: "#fff",
    fontWeight: "600" as const,
    fontSize: 15,
  },
  btnSecondary: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  btnSecondaryText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
  },
});

const tp = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  label: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    width: 90,
  },
  spinners: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  colon: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600" as const,
    paddingBottom: 2,
  },
});

const sp = StyleSheet.create({
  col: {
    alignItems: "center",
    gap: 4,
  },
  btn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    width: 42,
    alignItems: "center",
  },
  arrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  value: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600" as const,
    width: 42,
    textAlign: "center",
  },
});
