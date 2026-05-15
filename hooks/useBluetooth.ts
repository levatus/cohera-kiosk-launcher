/**
 * useBluetooth
 *
 * Polls the native BluetoothStatusModule every 5 seconds and returns the
 * current Bluetooth state. Initial state defaults to
 * { enabled: false, connectedDevice: null } until the first poll completes.
 */

import { useEffect, useState } from "react";
import { type BluetoothStatus, getBluetoothStatus } from "@/modules/BluetoothStatus";

const POLL_INTERVAL_MS = 5_000;

export function useBluetooth(): BluetoothStatus {
  const [status, setStatus] = useState<BluetoothStatus>({
    enabled: false,
    connectedDevice: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const result = await getBluetoothStatus();
      if (!cancelled) setStatus(result);
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return status;
}
