/**
 * useScreenSchedule
 *
 * Reads on/off schedule from AsyncStorage, uses event-driven timers, and:
 *  - returns whether the screen should currently be on
 *  - fires wakeScreen() / lockScreen() at transition boundaries
 *  - calls onRefresh() once per day at the configured refresh time
 *
 * Timer strategy
 * ──────────────
 * On/off transitions: a single setTimeout fires exactly at the next on/off
 *   boundary (typically two firings per day). After each firing the next
 *   boundary is computed and a new timer is armed.
 *
 * Daily refresh: a separate setTimeout fires exactly at the configured
 *   refresh time. On startup a 30-second recovery window catches the case
 *   where the hook mounts shortly after the refresh time.
 *
 * Storage keys:
 *   "kiosk:screen_schedule"  — { enabled, onHour, onMinute, offHour, offMinute,
 *                                refreshEnabled, refreshHour, refreshMinute }
 *   "kiosk:last_refresh"     — ISO date string of the last day a refresh fired
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { hideSystemUI, lockScreen, setKeepScreenOn, showSystemUI, wakeScreen } from "@/modules/ScreenControl";

const STORAGE_KEY = "kiosk:screen_schedule";
const LAST_REFRESH_KEY = "kiosk:last_refresh";

/** Milliseconds in one day. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum timer delay — guards against a tight loop exactly at a boundary. */
const MIN_DELAY_MS = 1_000;

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

/**
 * Returns milliseconds until the next on/off transition boundary.
 *
 * For a normal schedule (onMin < offMin):
 *   - Before on time  → wait until on time today
 *   - Between on/off  → wait until off time today
 *   - After off time  → wait until on time tomorrow
 *
 * For an overnight schedule (onMin >= offMin, e.g. on 22:00 → off 06:00):
 *   - After on time (evening)   → wait until off time tomorrow morning
 *   - Before off time (morning) → wait until off time today
 *   - Between off and on        → wait until on time today
 */
function msUntilNextTransition(schedule: ScreenSchedule): number {
  const now = new Date();
  const nowMin = toMinutes(now.getHours(), now.getMinutes());
  const onMin = toMinutes(schedule.onHour, schedule.onMinute);
  const offMin = toMinutes(schedule.offHour, schedule.offMinute);

  let targetHour: number;
  let targetMinute: number;
  let extraDays = 0;

  if (onMin < offMin) {
    if (nowMin < onMin) {
      targetHour = schedule.onHour;
      targetMinute = schedule.onMinute;
    } else if (nowMin < offMin) {
      targetHour = schedule.offHour;
      targetMinute = schedule.offMinute;
    } else {
      targetHour = schedule.onHour;
      targetMinute = schedule.onMinute;
      extraDays = 1;
    }
  } else {
    // overnight
    if (nowMin >= onMin) {
      targetHour = schedule.offHour;
      targetMinute = schedule.offMinute;
      extraDays = 1;
    } else if (nowMin < offMin) {
      targetHour = schedule.offHour;
      targetMinute = schedule.offMinute;
    } else {
      targetHour = schedule.onHour;
      targetMinute = schedule.onMinute;
    }
  }

  const target = new Date(now);
  target.setDate(target.getDate() + extraDays);
  target.setHours(targetHour, targetMinute, 0, 0);

  return Math.max(target.getTime() - now.getTime(), MIN_DELAY_MS);
}

/**
 * Returns milliseconds until a specific HH:MM today (or tomorrow if past).
 * Always returns at least MIN_DELAY_MS.
 */
function msUntilTime(hour: number, minute: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  let diff = target.getTime() - now.getTime();
  if (diff <= 0) diff += ONE_DAY_MS;
  return Math.max(diff, MIN_DELAY_MS);
}

interface Options {
  /** Called once per day when the refresh time is reached. */
  onRefresh?: () => void;
}

export function useScreenSchedule({ onRefresh }: Options = {}) {
  const [schedule, setSchedule] = useState<ScreenSchedule>(DEFAULT_SCHEDULE);
  const [screenOn, setScreenOn] = useState(true);

  const prevScreenOn = useRef(true);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const mountedRef = useRef(true);
  const scheduleRef = useRef<ScreenSchedule>(DEFAULT_SCHEDULE);

  /** Timer for the next on/off transition. */
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timer for the next daily refresh. */
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // ─── On/Off transition timer ───────────────────────────────────────────────

  const applyScreenState = useCallback(async (sched: ScreenSchedule) => {
    const on = shouldBeOn(sched);
    setScreenOn(on);
    // Always sync FLAG_KEEP_SCREEN_ON so the hook is self-sufficient on initial
    // evaluation (addFlags / clearFlags are idempotent; no cost to repeat calls).
    await setKeepScreenOn(on).catch(() => {});
    if (on !== prevScreenOn.current) {
      prevScreenOn.current = on;
      if (on) {
        await wakeScreen().catch(() => {});
        await showSystemUI().catch(() => {});
      } else {
        await lockScreen().catch(() => {
          // lockScreen() rejected (not device admin) — JS overlay handles it
        });
        await hideSystemUI().catch(() => {});
      }
    }
  }, []);

  /**
   * Arms a single timer that fires at the exact next on/off boundary.
   * After firing it evaluates screen state and re-arms for the following boundary.
   */
  const scheduleTransition = useCallback(() => {
    clearTransitionTimer();
    const sched = scheduleRef.current;
    if (!sched.enabled) return; // no transitions when scheduling is off

    const delay = msUntilNextTransition(sched);
    transitionTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await applyScreenState(scheduleRef.current);
      scheduleTransition(); // arm for the next boundary
    }, delay);
  }, [clearTransitionTimer, applyScreenState]);

  // ─── Daily refresh timer ───────────────────────────────────────────────────

  /**
   * Fires the onRefresh callback if it hasn't already fired today,
   * then arms the next daily refresh timer.
   */
  const fireRefreshAndReschedule = useCallback(async () => {
    const today = todayKey();
    const lastRefresh = await AsyncStorage.getItem(LAST_REFRESH_KEY).catch(() => null);
    if (lastRefresh !== today) {
      await AsyncStorage.setItem(LAST_REFRESH_KEY, today).catch(() => {});
      onRefreshRef.current?.();
    }
    scheduleRefresh(); // eslint-disable-line @typescript-eslint/no-use-before-define
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleRefresh = useCallback(() => {
    clearRefreshTimer();
    const sched = scheduleRef.current;
    if (!sched.refreshEnabled) return;

    const delay = msUntilTime(sched.refreshHour, sched.refreshMinute);
    refreshTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await fireRefreshAndReschedule();
    }, delay);
  }, [clearRefreshTimer, fireRefreshAndReschedule]);

  /**
   * Startup check: if the hook mounts within 30 seconds after the configured
   * refresh time and a refresh hasn't fired today, fire it immediately.
   */
  const checkRefreshOnStartup = useCallback(async (sched: ScreenSchedule) => {
    if (!sched.refreshEnabled) return;

    const now = new Date();
    const target = new Date(now);
    target.setHours(sched.refreshHour, sched.refreshMinute, 0, 0);
    const msSinceRefreshTime = now.getTime() - target.getTime();

    // Within the 30-second recovery window after the refresh time
    if (msSinceRefreshTime < 0 || msSinceRefreshTime > 30_000) return;

    const today = todayKey();
    const lastRefresh = await AsyncStorage.getItem(LAST_REFRESH_KEY).catch(() => null);
    if (lastRefresh === today) return; // already refreshed today

    await AsyncStorage.setItem(LAST_REFRESH_KEY, today).catch(() => {});
    onRefreshRef.current?.();
  }, []);

  // ─── Mount effect ──────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      // Load persisted schedule
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = {
            ...DEFAULT_SCHEDULE,
            ...(JSON.parse(raw) as Partial<ScreenSchedule>),
          };
          scheduleRef.current = parsed;
          setSchedule(parsed);
        }
      } catch {
        // ignore parse errors; stay with DEFAULT_SCHEDULE
      }

      if (!mountedRef.current) return;

      const sched = scheduleRef.current;

      // Evaluate screen on/off immediately
      await applyScreenState(sched);

      // Check refresh startup window, then arm the recurring daily timer
      await checkRefreshOnStartup(sched);
      scheduleRefresh();

      // Arm the first on/off transition timer
      scheduleTransition();
    })();

    return () => {
      mountedRef.current = false;
      clearTransitionTimer();
      clearRefreshTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── saveSchedule ──────────────────────────────────────────────────────────

  /**
   * Persists updated schedule settings, immediately re-evaluates screen state,
   * cancels existing timers, and re-arms them from the new settings.
   */
  const saveSchedule = useCallback(async (next: ScreenSchedule) => {
    scheduleRef.current = next;
    setSchedule(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    if (!mountedRef.current) return;
    await applyScreenState(next);
    scheduleRefresh();
    scheduleTransition();
  }, [applyScreenState, scheduleRefresh, scheduleTransition]);

  /**
   * Immediately wakes the screen without cancelling the existing schedule timers.
   * The screen will turn off again at the next scheduled off boundary.
   */
  const wakeNow = useCallback(async () => {
    setScreenOn(true);
    prevScreenOn.current = true;
    await setKeepScreenOn(true).catch(() => {});
    await wakeScreen().catch(() => {});
    await showSystemUI().catch(() => {});
  }, []);

  return { schedule, screenOn, saveSchedule, wakeNow };
}
