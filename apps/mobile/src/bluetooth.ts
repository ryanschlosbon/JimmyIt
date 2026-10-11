// Real-toy Bluetooth for Android (and iOS) builds. Metro uses bluetooth.web.ts on web.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import type { ToyConnector } from '@jimmyit/app-kit';
import { createBluetoothConnector } from '@jimmyit/ble-react-native';

/** Android 12+ asks for "nearby devices"; older Android asks for location to scan. */
async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const permissions = Platform.Version >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(permission => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

let connector: ToyConnector | null = null;

/**
 * The Bluetooth connector for the real toy (one BleManager per app run). The
 * BleManager is created on the first connect, not at launch: creating it is
 * what makes iOS ask for Bluetooth permission, and that should follow "Find Jimmy".
 */
export function createToyBluetoothConnector(): ToyConnector | null {
  return {
    kind: 'bluetooth',
    connect() {
      connector ??= createBluetoothConnector({
        manager: new BleManager(),
        storage: AsyncStorage,
        requestPermissions: requestBluetoothPermissions,
      });
      return connector.connect();
    },
  };
}
