# @jimmyit/ble-react-native

Turns a `react-native-ble-plx` connection into a `FidgetTransport`. Owned by
backend. Nothing outside the app shell should import it; screens and games talk
to `FidgetClient` from `@jimmyit/core`.

## App wiring

`createBluetoothConnector()` is the real-toy connector for app-kit. It asks for
permissions, goes straight to the last toy it used (remembered in storage) or
scans for one advertising the JimmyIt service, and connects:

```ts
import { BleManager } from 'react-native-ble-plx';
import { createBluetoothConnector } from '@jimmyit/ble-react-native';

const connector = createBluetoothConnector({ manager: new BleManager(), storage: AsyncStorage, requestPermissions });
const services = createJimmyServices({ storage: AsyncStorage, connector });
```

Before scanning it waits (up to 30 s) for the radio to report `PoweredOn`. Off
or unsupported Bluetooth rejects with `BluetoothUnavailableError`; iOS's
`Unauthorized` rejects with `BluetoothPermissionError`.

`apps/mobile/src/bluetooth.ts` does exactly this, with Android's permission
prompt. It creates the `BleManager` on the first connect, because creating it
is what shows iOS's Bluetooth permission prompt. The app uses it in release builds, or in a development build started
with `EXPO_PUBLIC_JIMMY_TOY=bluetooth`.

## Android requirements

- `react-native-ble-plx` 3.x needs a development build (Expo dev client or bare
  React Native), not Expo Go.
- Android 12+ (API 31+): request `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` at run
  time. Declare `BLUETOOTH_SCAN` with `android:usesPermissionFlags="neverForLocation"`.
- Android 11 and older: request `ACCESS_FINE_LOCATION` to scan.

## Status

The structural types in `ble-plx-types.ts` type-check against the real
`BleManager` and `Device` from react-native-ble-plx 3.5.1 (now installed in the
app). `bluetooth-connector.test.ts` runs the connector, the BLE transport and
the client end to end against a simulated radio built on the fake toy. Not yet
run on a phone against real firmware.
