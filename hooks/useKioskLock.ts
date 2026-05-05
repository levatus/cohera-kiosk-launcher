import { useCallback, useEffect, useRef, useState } from "react";
import { startLock, stopLock } from "@/modules/LockTask";

const RELOCK_SECONDS = 10;

export function useKioskLock() {
  const [isLocked, setIsLocked] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [relockSecondsLeft, setRelockSecondsLeft] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRelockTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRelockSecondsLeft(null);
  }, []);

  const lock = useCallback(async () => {
    clearRelockTimer();
    setLastError(null);
    try {
      await startLock();
      setIsLocked(true);
    } catch (e: unknown) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
  }, [clearRelockTimer]);

  const lockRef = useRef(lock);
  useEffect(() => {
    lockRef.current = lock;
  }, [lock]);

  const unlock = useCallback(async () => {
    setLastError(null);
    try {
      await stopLock();
      setIsLocked(false);
    } catch (e: unknown) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (isLocked) {
      clearRelockTimer();
      return;
    }

    setRelockSecondsLeft(RELOCK_SECONDS);

    let secondsLeft = RELOCK_SECONDS;
    intervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setRelockSecondsLeft(null);
        lockRef.current();
      } else {
        setRelockSecondsLeft(secondsLeft);
      }
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLocked, clearRelockTimer]);

  const toggle = useCallback(async () => {
    if (isLocked) {
      await unlock();
    } else {
      await lock();
    }
  }, [isLocked, lock, unlock]);

  return { isLocked, lastError, relockSecondsLeft, toggle, lock, unlock };
}
