import { type Cancel, createEmitter, type FidgetTransport, type Scheduler, systemScheduler } from '@jimmyit/core';
import { FIDGET_SERVICE_UUID, FidgetCharacteristicUuid } from '@jimmyit/protocol';
import { base64ToBytes, bytesToBase64 } from './base64';
import type { BleDeviceLike, BleManagerLike, BleSubscription } from './ble-plx-types';

export interface FoundFidget {
  readonly id: string;
  readonly name: string | null;
  readonly rssi: number | null;
}

/** Scans for fidgets advertising the JimmyIt service. Returns a stop function. */
export function scanForFidgets(
  manager: BleManagerLike,
  onFound: (fidget: FoundFidget) => void,
  options: { timeoutMs?: number; onError?: (error: Error) => void; scheduler?: Scheduler } = {},
): Cancel {
  const seen = new Set<string>();
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelTimeout();
    void manager.stopDeviceScan();
  };
  const cancelTimeout = (options.scheduler ?? systemScheduler).after(options.timeoutMs ?? 10_000, stop);
  void manager.startDeviceScan([FIDGET_SERVICE_UUID], null, (error, device) => {
    if (stopped) return;
    if (error) {
      stop();
      options.onError?.(error);
      return;
    }
    if (!device || seen.has(device.id)) return;
    seen.add(device.id);
    onFound({ id: device.id, name: device.name, rssi: device.rssi });
  });
  return stop;
}

/** Connects and returns a transport ready for connectFidgetClient(). */
export async function connectToFidget(manager: BleManagerLike, deviceId: string): Promise<FidgetTransport> {
  const connected = await manager.connectToDevice(deviceId);
  const device = await connected.discoverAllServicesAndCharacteristics();
  return createBleTransport(manager, device);
}

export function createBleTransport(manager: BleManagerLike, device: BleDeviceLike): FidgetTransport {
  const disconnects = createEmitter<Error | null>();
  const monitors = new Set<BleSubscription>();
  let linkUp = true;

  const disconnectSubscription = manager.onDeviceDisconnected(device.id, (error) => {
    if (!linkUp) return;
    linkUp = false;
    for (const monitor of monitors) monitor.remove();
    monitors.clear();
    disconnectSubscription.remove();
    disconnects.emit(error);
  });

  return {
    async read(characteristic) {
      const result = await device.readCharacteristicForService(FIDGET_SERVICE_UUID, FidgetCharacteristicUuid[characteristic]);
      return result.value === null ? new Uint8Array(0) : base64ToBytes(result.value);
    },
    async write(characteristic, bytes) {
      await device.writeCharacteristicWithResponseForService(
        FIDGET_SERVICE_UUID,
        FidgetCharacteristicUuid[characteristic],
        bytesToBase64(bytes),
      );
    },
    subscribe(characteristic, listener) {
      const monitor = device.monitorCharacteristicForService(
        FIDGET_SERVICE_UUID,
        FidgetCharacteristicUuid[characteristic],
        (error, value) => {
          // ble-plx reports an error on every monitor when the link drops;
          // onDisconnect covers that, so ignore errors here.
          if (error || !value?.value) return;
          listener(base64ToBytes(value.value));
        },
      );
      monitors.add(monitor);
      return () => {
        monitors.delete(monitor);
        monitor.remove();
      };
    },
    onDisconnect: (listener) => disconnects.subscribe(listener),
    async disconnect() {
      if (!linkUp) return;
      await device.cancelConnection();
    },
  };
}
