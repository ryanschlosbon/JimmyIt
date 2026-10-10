import { type FidgetTransport, type KeyValueStore, type Scheduler, systemScheduler } from '@jimmyit/core';
import { FIDGET_SERVICE_UUID } from '@jimmyit/protocol';
import type { BleDeviceLike, BleManagerLike } from './ble-plx-types';
import { connectToFidget } from './ble-transport';

export const LAST_TOY_STORAGE_KEY = 'jimmyit.lastToyId';

export class BluetoothPermissionError extends Error {
  override name = 'BluetoothPermissionError';
  constructor() {
    super('Bluetooth permission was not granted');
  }
}

export class ToyNotFoundError extends Error {
  override name = 'ToyNotFoundError';
  constructor(timeoutMs: number) {
    super(`no toy found within ${timeoutMs} ms`);
  }
}

export interface BluetoothConnectorOptions {
  /** A react-native-ble-plx BleManager, created once by the app. */
  readonly manager: BleManagerLike;
  /** Asks for Android's Bluetooth permissions; resolve false if refused. */
  readonly requestPermissions?: () => Promise<boolean>;
  /** Remembers the last toy so reconnecting goes straight to it. */
  readonly storage?: KeyValueStore;
  readonly scanTimeoutMs?: number;
  readonly connectTimeoutMs?: number;
  readonly scheduler?: Scheduler;
}

/**
 * The real-toy connector for app-kit's createJimmyServices({ connector }).
 * Same shape as @jimmyit/dev-toy's simulated connector, so nothing else in the
 * app changes when the hardware arrives.
 */
export function createBluetoothConnector(options: BluetoothConnectorOptions): {
  readonly kind: 'bluetooth';
  connect(): Promise<FidgetTransport>;
} {
  const { manager, storage } = options;
  const scheduler = options.scheduler ?? systemScheduler;
  const scanTimeoutMs = options.scanTimeoutMs ?? 12_000;
  const connectTimeoutMs = options.connectTimeoutMs ?? 8_000;

  function scanForFirstToy(): Promise<BleDeviceLike> {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (result: { device?: BleDeviceLike; error?: Error }) => {
        if (done) return;
        done = true;
        cancelTimeout();
        void manager.stopDeviceScan();
        if (result.device) resolve(result.device);
        else reject(result.error ?? new ToyNotFoundError(scanTimeoutMs));
      };
      const cancelTimeout = scheduler.after(scanTimeoutMs, () => finish({ error: new ToyNotFoundError(scanTimeoutMs) }));
      void manager.startDeviceScan([FIDGET_SERVICE_UUID], null, (error, device) => {
        if (error) finish({ error });
        else if (device) finish({ device });
      });
    });
  }

  return {
    kind: 'bluetooth',
    async connect() {
      if (options.requestPermissions && !(await options.requestPermissions())) throw new BluetoothPermissionError();
      const lastToyId = await storage?.getItem(LAST_TOY_STORAGE_KEY).catch(() => null);
      if (lastToyId) {
        try {
          return await connectToFidget(manager, lastToyId, { timeoutMs: connectTimeoutMs });
        } catch {
          // Out of range or a different toy now: fall back to scanning.
        }
      }
      const device = await scanForFirstToy();
      const transport = await connectToFidget(manager, device.id, { timeoutMs: connectTimeoutMs });
      await storage?.setItem(LAST_TOY_STORAGE_KEY, device.id).catch(() => undefined);
      return transport;
    },
  };
}
