/**
 * An invisible 48×48 tap target in the bottom-right corner.
 * Staff hold it for 5 seconds to trigger the kiosk escape flow.
 * A subtle ring animation grows as the hold progresses so there
 * is tactile feedback without being visually prominent.
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const HOLD_DURATION_MS = 5000;

interface Props {
  onEscape: () => void;
}

export function LongPressEscapeButton({ onEscape }: Props) {
  const [pressing, setPressing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPress = useCallback(() => {
    setPressing(true);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: false,
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        setPressing(false);
        progress.setValue(0);
        onEscape();
      }
    });
  }, [onEscape, progress]);

  const endPress = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
    setPressing(false);
    progress.setValue(0);
  }, [progress]);

  const ringSize = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 48],
  });

  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 0.5, 1],
  });

  return (
    <TouchableWithoutFeedback
      onPressIn={startPress}
      onPressOut={endPress}
      testID="escape-button"
    >
      <View style={styles.hitTarget}>
        {pressing && (
          <Animated.View
            style={[
              styles.ring,
              { width: ringSize, height: ringSize, borderRadius: 24, opacity: ringOpacity },
            ]}
          />
        )}
        <View style={styles.dot} />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  hitTarget: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  ring: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.25)",
  },
});
