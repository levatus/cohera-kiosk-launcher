import { useCallback, useState } from "react";
import { startLock, stopLock } from "@/modules/LockTask";

export function useKioskLock() {
  const [isLocked, setIsLocked] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const lock = useCallback(async () => {
    setLastError(null);
    try {
      await startLock();
      setIsLocked(true);
    } catch (e: unknown) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const unlock = useCallback(async () => {
    setLastError(null);
    try {
      await stopLock();
      setIsLocked(false);
    } catch (e: unknown) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const toggle = useCallback(async () => {
    if (isLocked) {
      await unlock();
    } else {
      await lock();
    }
  }, [isLocked, lock, unlock]);

  return { isLocked, lastError, toggle, lock, unlock };
}
