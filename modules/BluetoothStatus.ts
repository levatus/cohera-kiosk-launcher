/**
 * Thin wrapper around the native BluetoothStatusModule.
 *
 * getBluetoothStatus() — returns the current Bluetooth state:
 *   - enabled: whether the Bluetooth adapter is powered on
 *   - connectedDevice: name of the first A2DP-connected device, or null
 *
 * Returns a safe fallback { enabled: false, connectedDevice: null } on
 * non-Android platforms or when the native module is unavailable.
 */

import { NativeModules, Platform } from "react-native";

export interface BluetoothStatus {
  enabled: boolean;
  connectedDevice: string | null;
}

const { BluetoothStatusModule } = NativeModules;

const FALLBACK: BluetoothStatus = { enabled: false, connectedDevice: null };

export async function getBluetoothStatus(): Promise<BluetoothStatus> {
  if (Platform.OS !== "android" || !BluetoothStatusModule) return FALLBACK;
  try {
    return await BluetoothStatusModule.getBluetoothStatus();
  } catch {
    return FALLBACK;
  }
}
