import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const CORRECT_PIN = "1561";
const PIN_LENGTH = 4;

interface Props {
  visible: boolean;
  onSuccess: () => void;
  onDismiss: () => void;
}

export function PinModal({ visible, onSuccess, onDismiss }: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDigits([]);
      setError(false);
      setShake(false);
    }
  }, [visible]);

  const press = (d: string) => {
    if (digits.length >= PIN_LENGTH) return;
    setError(false);
    const next = [...digits, d];
    setDigits(next);

    if (next.length === PIN_LENGTH) {
      const entered = next.join("");
      if (entered === CORRECT_PIN) {
        setTimeout(() => {
          onSuccess();
          setDigits([]);
          setError(false);
        }, 120);
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setDigits([]);
          setShake(false);
        }, 600);
      }
    }
  };

  const del = () => {
    setError(false);
    setDigits((prev) => prev.slice(0, -1));
  };

  const pad = (label: string, onPress: () => void, variant: "num" | "del" | "empty" = "num") => (
    <Pressable
      key={label}
      style={({ pressed }) => [
        styles.key,
        variant === "del" && styles.keyDel,
        variant === "empty" && styles.keyEmpty,
        pressed && variant !== "empty" && styles.keyPressed,
      ]}
      onPress={onPress}
      disabled={variant === "empty"}
    >
      <Text style={[styles.keyText, variant === "del" && styles.keyDelText]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.card, shake && styles.cardShake]}>
          <Text style={styles.title}>Admin Access</Text>
          <Text style={styles.subtitle}>Enter PIN to continue</Text>

          <View style={styles.dots}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < digits.length && styles.dotFilled,
                  error && styles.dotError,
                ]}
              />
            ))}
          </View>

          {error && (
            <Text style={styles.errorText}>Incorrect PIN</Text>
          )}

          <View style={styles.numpad}>
            {["1","2","3","4","5","6","7","8","9"].map((d) => (
              <Pressable
                key={d}
                style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                onPress={() => press(d)}
              >
                <Text style={styles.keyText}>{d}</Text>
              </Pressable>
            ))}
            <View style={styles.keyEmpty} />
            <Pressable
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              onPress={() => press("0")}
            >
              <Text style={styles.keyText}>0</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.key, styles.keyDel, pressed && styles.keyPressed]}
              onPress={del}
            >
              <Text style={styles.keyDelText}>⌫</Text>
            </Pressable>
          </View>

          <Pressable style={styles.cancelBtn} onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 32,
    width: 320,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardShake: {
    borderColor: "#f87171",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginBottom: 28,
  },
  dots: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: "#4a9eff",
    borderColor: "#4a9eff",
  },
  dotError: {
    borderColor: "#f87171",
    backgroundColor: "#f87171",
  },
  errorText: {
    color: "#f87171",
    fontSize: 12,
    marginBottom: 8,
    fontWeight: "500" as const,
  },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 216,
    gap: 10,
    marginTop: 12,
    justifyContent: "center",
  },
  key: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  keyPressed: {
    backgroundColor: "rgba(74,158,255,0.25)",
  },
  keyDel: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  keyEmpty: {
    width: 62,
    height: 62,
  },
  keyText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "500" as const,
  },
  keyDelText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 20,
  },
  cancelBtn: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cancelText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    fontWeight: "500" as const,
  },
});
