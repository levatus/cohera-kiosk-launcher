/**
 * useScreenSchedule
 *
 * Reads on/off schedule from AsyncStorage, polls every 30 seconds, and:
 *  - returns whether the screen should currently be on
 *  - fires wakeScreen() / lockScreen() at transition boundaries
 *  - calls onRefresh() once per day at the configured refresh time
 *
 * Storage keys:
 *   "kiosk:screen_schedule"  — { enabled, onHour, onMinute, offHour, offMinute,
 *                                refreshEnabled, refreshHour, refreshMinute }
 *   "kiosk:last_refresh"     — ISO date string of the last day a refresh fired
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { lockScreen, wakeScreen } from "@/modules/ScreenControl";

const STORAGE_KEY = "kiosk:screen_schedule";
const LAST_REFRESH_KEY = "kiosk:last_refresh";
const POLL_INTERVAL_MS = 30_000;

export interface ScreenSchedule {
  enabled: boolean;
  onHour: number;
  onMinute: number;
  offHour: number;
  offMinute: number;
  refreshEnabled: boolean;
  refreshHour: number;
  refreshMinute: number;
}

export const DEFAULT_SCHEDULE: ScreenSchedule = {
  enabled: false,
  onHour: 8,
  onMinute: 0,
  offHour: 20,
  offMinute: 0,
  refreshEnabled: true,
  refreshHour: 7,
  refreshMinute: 0,
};

function toMinutes(hour: number, minute: number) {
  return hour * 60 + minute;
}

/** Returns today as a YYYY-MM-DD string for last-refresh tracking. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function shouldBeOn(schedule: ScreenSchedule): boolean {
  if (!schedule.enabled) return true;
  const now = new Date();
  const nowMin = toMinutes(now.getHours(), now.getMinutes());
  const onMin = toMinutes(schedule.onHour, schedule.onMinute);
  const offMin = toMinutes(schedule.offHour, schedule.offMinute);

  if (onMin < offMin) {
    return nowMin >= onMin && nowMin < offMin;
  }
  // overnight schedule (e.g. on at 22:00, off at 06:00)
  return nowMin >= onMin || nowMin < offMin;
}

interface Options {
  /** Called once per day when the refresh window is reached. */
  onRefresh?: () => void;
}

export function useScreenSchedule({ onRefresh }: Options = {}) {
  const [schedule, setSchedule] = useState<ScreenSchedule>(DEFAULT_SCHEDULE);
  const [screenOn, setScreenOn] = useState(true);
  const prevScreenOn = useRef(true);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const loadSchedule = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        // Merge with defaults so new fields are present on existing stored data
        const parsed = { ...DEFAULT_SCHEDULE, ...(JSON.parse(raw) as Partial<ScreenSchedule>) };
        setSchedule(parsed);
        return parsed;
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_SCHEDULE;
  }, []);

  const saveSchedule = useCallback(async (next: ScreenSchedule) => {
    setSchedule(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const checkRefresh = useCallback(async (sched: ScreenSchedule) => {
    if (!sched.refreshEnabled) return;

    const now = new Date();
    const nowMin = toMinutes(now.getHours(), now.getMinutes());
    const refreshMin = toMinutes(sched.refreshHour, sched.refreshMinute);

    // Fire if we are within the 30-second polling window of the refresh time
    if (nowMin < refreshMin || nowMin > refreshMin) return;

    const today = todayKey();
    const lastRefresh = await AsyncStorage.getItem(LAST_REFRESH_KEY).catch(() => null);
    if (lastRefresh === today) return; // already refreshed today

    await AsyncStorage.setItem(LAST_REFRESH_KEY, today).catch(() => {});
    onRefreshRef.current?.();
  }, []);

  const evaluate = useCallback(async (sched: ScreenSchedule) => {
    const on = shouldBeOn(sched);
    setScreenOn(on);

    if (on !== prevScreenOn.current) {
      prevScreenOn.current = on;
      if (on) {
        await wakeScreen().catch(() => {});
      } else {
        await lockScreen().catch(() => {
          // lockScreen() rejected (not device admin) — JS overlay handles it
        });
      }
    }

    await checkRefresh(sched);
  }, [checkRefresh]);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval>;

    (async () => {
      const sched = await loadSchedule();
      if (!mounted) return;
      await evaluate(sched);

      timer = setInterval(async () => {
        const s = await loadSchedule();
        if (mounted) await evaluate(s);
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [loadSchedule, evaluate]);

  return { schedule, screenOn, saveSchedule };
}
