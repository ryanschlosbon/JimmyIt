// The parts of react-native-ble-plx (v3) this package uses, typed
// structurally so core stays installable and testable without React Native.
// A real `BleManager` / `Device` from react-native-ble-plx satisfies these.

export interface BleSubscription {
  remove(): void;
}

export interface BleCharacteristicLike {
  /** Base64, or null when the characteristic is empty. */
  readonly value: string | null;
}

export interface BleDeviceLike {
  readonly id: string;
  readonly name: string | null;
  readonly rssi: number | null;
  discoverAllServicesAndCharacteristics(): Promise<BleDeviceLike>;
  readCharacteristicForService(serviceUUID: string, characteristicUUID: string): Promise<BleCharacteristicLike>;
  writeCharacteristicWithResponseForService(
    serviceUUID: string,
    characteristicUUID: string,
    valueBase64: string,
  ): Promise<BleCharacteristicLike>;
  monitorCharacteristicForService(
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: Error | null, characteristic: BleCharacteristicLike | null) => void,
  ): BleSubscription;
  cancelConnection(): Promise<BleDeviceLike>;
}

export interface BleManagerLike {
  startDeviceScan(
    uuids: string[] | null,
    options: object | null,
    listener: (error: Error | null, device: BleDeviceLike | null) => void,
  ): unknown;
  stopDeviceScan(): unknown;
  connectToDevice(deviceId: string, options?: { timeout?: number }): Promise<BleDeviceLike>;
  onDeviceDisconnected(deviceId: string, listener: (error: Error | null, device: BleDeviceLike | null) => void): BleSubscription;
}
