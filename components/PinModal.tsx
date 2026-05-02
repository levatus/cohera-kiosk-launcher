/**
 * PIN entry modal for the kiosk exit flow.
 *
 * Shown when staff hold the escape button for 5 seconds.
 * Calls onSuccess() only when the correct PIN is entered.
 * After 5 wrong attempts the modal auto-closes (security cooldown).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const MAX_ATTEMPTS = 5;

interface Props {
  visible: boolean;
  onSuccess: () => void;
  onDismiss: () => void;
  correctPin: string;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

export function PinModal({ visible, onSuccess, onDismiss, correctPin }: Props) {
  const [entered, setEntered] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setEntered("");
      setAttempts(0);
      setError(false);
    }
  }, [visible]);

  const shake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  }, [shakeAnim]);

  const handleKey = useCallback(
    (key: string) => {
      if (key === "⌫") {
        setEntered((prev) => prev.slice(0, -1));
        setError(false);
        return;
      }
      if (key === "") return;

      const next = entered + key;
      setEntered(next);

      if (next.length === correctPin.length) {
        if (next === correctPin) {
          setEntered("");
          onSuccess();
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          setError(true);
          shake();
          setTimeout(() => {
            setEntered("");
            setError(false);
            if (newAttempts >= MAX_ATTEMPTS) {
              onDismiss();
            }
          }, 600);
        }
      }
    },
    [entered, correctPin, attempts, onSuccess, onDismiss, shake]
  );

  const dots = Array.from({ length: correctPin.length }, (_, i) => ({
    filled: i < entered.length,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Staff Access</Text>
          <Text style={styles.subtitle}>Enter PIN to exit kiosk mode</Text>

          <Animated.View
            style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}
          >
            {dots.map((d, i) => (
              <View
                key={i}
                style={[styles.dot, d.filled && styles.dotFilled, error && styles.dotError]}
              />
            ))}
          </Animated.View>

          {error && attempts < MAX_ATTEMPTS && (
            <Text style={styles.errorText}>
              Incorrect PIN ({MAX_ATTEMPTS - attempts} attempts left)
            </Text>
          )}
          {attempts >= MAX_ATTEMPTS && (
            <Text style={styles.errorText}>Too many attempts</Text>
          )}

          <View style={styles.keypad}>
            {KEYS.map((row, ri) => (
              <View key={ri} style={styles.row}>
                {row.map((key, ki) => (
                  <Pressable
                    key={ki}
                    style={({ pressed }) => [
                      styles.key,
                      key === "" && styles.keyEmpty,
                      pressed && key !== "" && styles.keyPressed,
                    ]}
                    onPress={() => handleKey(key)}
                    disabled={key === ""}
                    testID={`pin-key-${key}`}
                  >
                    <Text style={[styles.keyText, key === "⌫" && styles.backspace]}>
                      {key}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          <Pressable style={styles.cancel} onPress={onDismiss}>
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
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#1a2540",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    width: 320,
    gap: 0,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    marginBottom: 28,
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: "#4a9eff",
    borderColor: "#4a9eff",
  },
  dotError: {
    borderColor: "#ff4d4d",
    backgroundColor: "#ff4d4d",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 13,
    marginBottom: 4,
    textAlign: "center",
  },
  keypad: {
    marginTop: 24,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  keyEmpty: {
    backgroundColor: "transparent",
  },
  keyPressed: {
    backgroundColor: "rgba(74,158,255,0.35)",
  },
  keyText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "500" as const,
  },
  backspace: {
    fontSize: 20,
  },
  cancel: {
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  cancelText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 15,
  },
});
