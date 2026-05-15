/**
 * useAutoUpdate
 *
 * Persists auto-update preferences in AsyncStorage and arms a daily
 * setTimeout that fires `onCheck` once per day at the configured local time,
 * then re-arms itself for the next day — exactly the same timer strategy
 * used by useScreenSchedule for its daily refresh timer.
 *
 * Storage key: "kiosk:auto_update"
 * Shape: { enabled: boolean, hour: number, minute: number }
 *
 * Timer strategy
 * ──────────────
 * A single setTimeout fires exactly at the configured HH:MM in the device's
 * local timezone. After firing it checks whether a check has already run
 * today (keyed by YYYY-MM-DD), fires onCheck() if not, then re-arms for the
 * same time tomorrow.
 *
 * A 30-second startup recovery window catches the case where the hook mounts
 * shortly after the scheduled time without a check having run yet today.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "kiosk:auto_update";
const LAST_CHECK_KEY = "kiosk:last_update_check";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DELAY_MS = 1_000;

export interface AutoUpdateSettings {
  enabled: boolean;
  /** 0–23 */
  hour: number;
  /** 0–59 */
  minute: number;
}

export const DEFAULT_AUTO_UPDATE_SETTINGS: AutoUpdateSettings = {
  enabled: false,
  hour: 3,
  minute: 0,
};

/** Returns today as a YYYY-MM-DD string for deduplication. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Returns milliseconds until a specific HH:MM today, or tomorrow if that
 * time has already passed. Always returns at least MIN_DELAY_MS.
 */
function msUntilTime(hour: number, minute: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  let diff = target.getTime() - now.getTime();
  if (diff <= 0) diff += ONE_DAY_MS;
  return Math.max(diff, MIN_DELAY_MS);
}

/**
 * Returns a human-readable local-time string for the next scheduled check,
 * e.g. "3:00 AM". Returns null when settings.enabled is false.
 */
export function formatNextCheckTime(settings: AutoUpdateSettings): string | null {
  if (!settings.enabled) return null;
  const h12 = settings.hour % 12 === 0 ? 12 : settings.hour % 12;
  const ampm = settings.hour < 12 ? "AM" : "PM";
  const mm = String(settings.minute).padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}

interface Options {
  /** Called once per day when the scheduled check time is reached. */
  onCheck?: () => void;
}

export function useAutoUpdate({ onCheck }: Options = {}) {
  const [settings, setSettings] = useState<AutoUpdateSettings>(DEFAULT_AUTO_UPDATE_SETTINGS);

  const mountedRef = useRef(true);
  const settingsRef = useRef<AutoUpdateSettings>(DEFAULT_AUTO_UPDATE_SETTINGS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCheckRef = useRef(onCheck);

  useEffect(() => { onCheckRef.current = onCheck; }, [onCheck]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ─── Fire check and re-arm ────────────────────────────────────────────────

  // Forward-declared so fireAndReschedule can call scheduleCheck.
  const scheduleCheckRef = useRef<(() => void) | null>(null);

  const fireAndReschedule = useCallback(async () => {
    const today = todayKey();
    const last = await AsyncStorage.getItem(LAST_CHECK_KEY).catch(() => null);
    if (last !== today) {
      await AsyncStorage.setItem(LAST_CHECK_KEY, today).catch(() => {});
      onCheckRef.current?.();
    }
    scheduleCheckRef.current?.();
  }, []);

  const scheduleCheck = useCallback(() => {
    clearTimer();
    const s = settingsRef.current;
    if (!s.enabled) return;

    const delay = msUntilTime(s.hour, s.minute);
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      await fireAndReschedule();
    }, delay);
  }, [clearTimer, fireAndReschedule]);

  // Store the latest scheduleCheck in the ref so fireAndReschedule can call it.
  useEffect(() => {
    scheduleCheckRef.current = scheduleCheck;
  }, [scheduleCheck]);

  // ─── Startup recovery window ──────────────────────────────────────────────

  const checkOnStartup = useCallback(async (s: AutoUpdateSettings) => {
    if (!s.enabled) return;

    const now = new Date();
    const target = new Date(now);
    target.setHours(s.hour, s.minute, 0, 0);
    const msSince = now.getTime() - target.getTime();

    // Only fire within 30 seconds after the scheduled time.
    if (msSince < 0 || msSince > 30_000) return;

    const today = todayKey();
    const last = await AsyncStorage.getItem(LAST_CHECK_KEY).catch(() => null);
    if (last === today) return;

    await AsyncStorage.setItem(LAST_CHECK_KEY, today).catch(() => {});
    onCheckRef.current?.();
  }, []);

  // ─── Mount effect ─────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: AutoUpdateSettings = {
            ...DEFAULT_AUTO_UPDATE_SETTINGS,
            ...(JSON.parse(raw) as Partial<AutoUpdateSettings>),
          };
          settingsRef.current = parsed;
          setSettings(parsed);
        }
      } catch {
        // ignore parse errors; stay with DEFAULT_AUTO_UPDATE_SETTINGS
      }

      if (!mountedRef.current) return;

      await checkOnStartup(settingsRef.current);
      scheduleCheckRef.current?.();
    })();

    return () => {
      mountedRef.current = false;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── saveSettings ─────────────────────────────────────────────────────────

  const saveSettings = useCallback(async (next: AutoUpdateSettings) => {
    settingsRef.current = next;
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    if (!mountedRef.current) return;
    scheduleCheckRef.current?.();
  }, []);

  /**
   * Cancel any pending timer and re-arm it from the current settings.
   * Useful for callers that need to explicitly re-schedule (e.g. after
   * a manual check completes and the caller wants to reset the timer).
   */
  const scheduleNextCheck = useCallback(() => {
    scheduleCheckRef.current?.();
  }, []);

  return { settings, saveSettings, scheduleNextCheck };
}
