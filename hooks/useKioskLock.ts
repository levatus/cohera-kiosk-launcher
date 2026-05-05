import { useCallback, useState } from "react";
import { startLock, stopLock } from "@/modules/LockTask";

export function useKioskLock() {
  // Start as locked — matches LockTaskModule.kioskEnabled = true default,
  // so the icon and native state are in sync from the first render.
  const [isLocked, setIsLocked] = useState(true);

  const toggle = useCallback(async () => {
    if (!isLocked) {
      await startLock();
    } else {
      await stopLock();
    }
    setIsLocked((prev) => !prev);
  }, [isLocked]);

  return { isLocked, toggle };
}
