import { NativeModules, Platform } from "react-native";

interface LockTaskNativeModule {
  startLock: () => Promise<void>;
  stopLock: () => Promise<void>;
}

const { LockTaskModule } = NativeModules as {
  LockTaskModule: LockTaskNativeModule | undefined;
};

export async function startLock(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!LockTaskModule) throw new Error("LockTaskModule not registered");
  await LockTaskModule.startLock();
}

export async function stopLock(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!LockTaskModule) throw new Error("LockTaskModule not registered");
  await LockTaskModule.stopLock();
}
