import { useCallback, useState } from "react";
import { startLock, stopLock } from "@/modules/LockTask";

export function useKioskLock() {
  const [isLocked, setIsLocked] = useState(false);

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
