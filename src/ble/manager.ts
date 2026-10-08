import { BleManager } from 'react-native-ble-plx';

// react-native-ble-plx expects a single BleManager per app.
let instance: BleManager | null = null;

export function getBleManager(): BleManager {
  instance ??= new BleManager();
  return instance;
}
