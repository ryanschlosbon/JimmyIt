# @jimmyit/ble-react-native

Turns a `react-native-ble-plx` connection into a `FidgetTransport`. Owned by
backend. Nothing outside the app shell should import it; screens and games talk
to `FidgetClient` from `@jimmyit/core`.

## App wiring (frontend does this once)

```ts
import { BleManager } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectFidgetClient, createScoreRepository, startScoreSync } from '@jimmyit/core';
import { connectToFidget, scanForFidgets } from '@jimmyit/ble-react-native';

const manager = new BleManager();
const repository = createScoreRepository(AsyncStorage);

const stopScan = scanForFidgets(manager, async (found) => {
  stopScan();
  const transport = await connectToFidget(manager, found.id);
  const client = await connectFidgetClient(transport);
  await startScoreSync(client, repository);
  // hand `client` to screens and games
});
```

During development, swap the two BLE lines for
`createFakeFidget().transport` from `@jimmyit/fake-fidget`.

## Android requirements

- `react-native-ble-plx` 3.x needs a development build (Expo dev client or bare
  React Native), not Expo Go.
- Android 12+ (API 31+): request `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` at run
  time. Declare `BLUETOOTH_SCAN` with `android:usesPermissionFlags="neverForLocation"`.
- Android 11 and older: request `ACCESS_FINE_LOCATION` to scan.

## Status

The structural types in `ble-plx-types.ts` type-check against the real
`BleManager` and `Device` from react-native-ble-plx 3.5.1. The adapter has not
yet been run on a phone against real firmware.
