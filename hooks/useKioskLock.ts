import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";

export function useKioskLock() {
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("visible");
    }
  }, []);

  const toggle = useCallback(async () => {
    if (Platform.OS === "android") {
      if (!isLocked) {
        await NavigationBar.setVisibilityAsync("hidden");
        await NavigationBar.setBehaviorAsync("overlay-swipe");
      } else {
        await NavigationBar.setVisibilityAsync("visible");
      }
    }
    setIsLocked((prev) => !prev);
  }, [isLocked]);

  return { isLocked, toggle };
}
