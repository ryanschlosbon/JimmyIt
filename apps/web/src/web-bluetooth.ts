import type { ToyConnector } from '@jimmyit/app-kit';
import { createEmitter, type FidgetTransport } from '@jimmyit/core';
import { FIDGET_SERVICE_UUID, FidgetCharacteristicUuid } from '@jimmyit/protocol';

interface WebCharacteristic {
  readValue(): Promise<DataView>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<WebCharacteristic>;
  stopNotifications(): Promise<WebCharacteristic>;
  addEventListener(type: 'characteristicvaluechanged', listener: EventListener): void;
  removeEventListener(type: 'characteristicvaluechanged', listener: EventListener): void;
  readonly value?: DataView;
}

interface WebDevice extends EventTarget {
  readonly gatt?: {
    connect(): Promise<{ getPrimaryService(uuid: string): Promise<{
      getCharacteristic(uuid: string): Promise<WebCharacteristic>;
    }> }>;
    disconnect(): void;
  };
}

interface WebNavigator extends Navigator {
  readonly bluetooth?: {
    requestDevice(options: { filters: readonly { services: readonly string[] }[] }): Promise<WebDevice>;
  };
}

const bytes = (value: DataView): Uint8Array =>
  new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator && window.isSecureContext;
}

/** Browser-only connector. The shared client still owns approval, decoding and score sync. */
export function createWebBluetoothConnector(): ToyConnector | null {
  if (!isWebBluetoothAvailable()) return null;
  return {
    kind: 'bluetooth',
    async connect(): Promise<FidgetTransport> {
      const bluetooth = (navigator as WebNavigator).bluetooth;
      if (!bluetooth) throw new Error('Bluetooth is unavailable in this browser.');
      // requestDevice must run from the user's click, before any asynchronous setup.
      const device = await bluetooth.requestDevice({ filters: [{ services: [FIDGET_SERVICE_UUID] }] });
      const server = await device.gatt?.connect();
      if (!server) throw new Error('Jimmy did not open a Bluetooth connection.');
      const service = await server.getPrimaryService(FIDGET_SERVICE_UUID);
      const characteristics = {
        info: await service.getCharacteristic(FidgetCharacteristicUuid.info),
        input: await service.getCharacteristic(FidgetCharacteristicUuid.input),
        message: await service.getCharacteristic(FidgetCharacteristicUuid.message),
        command: await service.getCharacteristic(FidgetCharacteristicUuid.command),
      };
      const disconnects = createEmitter<Error | null>();
      const subscriptions = new Set<() => void>();
      const disconnected = () => disconnects.emit(null);
      device.addEventListener('gattserverdisconnected', disconnected);
      await characteristics.input.startNotifications();
      await characteristics.message.startNotifications();
      return {
        async read(characteristic) {
          return bytes(await characteristics[characteristic].readValue());
        },
        async write(_characteristic, value) {
          await characteristics.command.writeValueWithResponse(new Uint8Array(value));
        },
        subscribe(characteristic, listener) {
          const target = characteristics[characteristic];
          const changed: EventListener = () => {
            if (target.value) listener(bytes(target.value));
          };
          target.addEventListener('characteristicvaluechanged', changed);
          const stop = () => target.removeEventListener('characteristicvaluechanged', changed);
          subscriptions.add(stop);
          return () => { subscriptions.delete(stop); stop(); };
        },
        onDisconnect: (listener) => disconnects.subscribe(listener),
        async disconnect() {
          for (const stop of subscriptions) stop();
          subscriptions.clear();
          device.removeEventListener('gattserverdisconnected', disconnected);
          await Promise.all([
            characteristics.input.stopNotifications(),
            characteristics.message.stopNotifications(),
          ]).catch(() => undefined);
          device.gatt?.disconnect();
        },
      };
    },
  };
}
