// Runs the real Bluetooth code path (connector + BLE transport + client) against
// a simulated radio: a BleManagerLike whose one device is the fake toy.
import {
  connectFidgetClient,
  createManualTime,
  createMemoryKeyValueStore,
  type FidgetEvent,
  type Scheduler,
} from '@jimmyit/core';
import { createFakeFidget, type FakeFidget } from '@jimmyit/fake-fidget';
import { FIDGET_SERVICE_UUID, type FidgetCharacteristic, FidgetCharacteristicUuid } from '@jimmyit/protocol';
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';
import type { BleDeviceLike, BleManagerLike, BleState } from './ble-plx-types';
import {
  BluetoothPermissionError,
  BluetoothUnavailableError,
  createBluetoothConnector,
  LAST_TOY_STORAGE_KEY,
  ToyNotFoundError,
} from './bluetooth-connector';

const TOY_ID = 'C0:FF:EE:00:00:01';

function characteristicName(uuid: string): FidgetCharacteristic {
  const entry = Object.entries(FidgetCharacteristicUuid).find(([, value]) => value === uuid);
  if (!entry) throw new Error(`unknown characteristic ${uuid}`);
  return entry[0] as FidgetCharacteristic;
}

interface RadioOptions {
  readonly advertising?: boolean;
  readonly state?: BleState;
}

function simulatedRadio(toy: FakeFidget, options: RadioOptions = {}) {
  const calls = { scans: 0, connects: [] as string[] };
  let state: BleState = options.state ?? 'PoweredOn';
  const stateListeners = new Set<(state: BleState) => void>();
  const setState = (next: BleState) => {
    state = next;
    for (const listener of stateListeners) listener(next);
  };
  const device: BleDeviceLike = {
    id: TOY_ID,
    name: 'JimmyIt',
    rssi: -50,
    discoverAllServicesAndCharacteristics: async () => device,
    async readCharacteristicForService(service, uuid) {
      expect(service).toBe(FIDGET_SERVICE_UUID);
      const name = characteristicName(uuid);
      if (name !== 'info' && name !== 'input') throw new Error(`${name} is not readable`);
      return { value: bytesToBase64(await toy.transport.read(name)) };
    },
    async writeCharacteristicWithResponseForService(_service, uuid, value) {
      expect(characteristicName(uuid)).toBe('command');
      await toy.transport.write('command', base64ToBytes(value));
      return { value };
    },
    monitorCharacteristicForService(_service, uuid, listener) {
      const name = characteristicName(uuid);
      if (name !== 'input' && name !== 'message') throw new Error(`${name} does not notify`);
      const stop = toy.transport.subscribe(name, (bytes) => listener(null, { value: bytesToBase64(bytes) }));
      return { remove: stop };
    },
    async cancelConnection() {
      toy.dropConnection();
      return device;
    },
  };
  const manager: BleManagerLike = {
    onStateChange(listener, emitCurrentState) {
      stateListeners.add(listener);
      if (emitCurrentState) listener(state);
      return { remove: () => stateListeners.delete(listener) };
    },
    startDeviceScan(uuids, _options, listener) {
      calls.scans++;
      // Like ble-plx: scanning before PoweredOn fails.
      if (state !== 'PoweredOn') {
        listener(new Error(`BluetoothLE is in ${state} state`), null);
        return;
      }
      if ((options.advertising ?? true) && uuids?.includes(FIDGET_SERVICE_UUID)) {
        void Promise.resolve().then(() => listener(null, device));
      }
    },
    stopDeviceScan: () => undefined,
    async connectToDevice(id) {
      calls.connects.push(id);
      if (id !== TOY_ID || !toy.linked) throw new Error('device not found');
      return device;
    },
    onDeviceDisconnected(_id, listener) {
      return { remove: toy.transport.onDisconnect((error) => listener(error, null)) };
    },
  };
  return { manager, calls, setState, stateListeners };
}

function setup(options: RadioOptions = {}) {
  const time = createManualTime(Date.UTC(2026, 9, 10));
  const toy = createFakeFidget({ clock: time.clock });
  const radio = simulatedRadio(toy, options);
  const storage = createMemoryKeyValueStore();
  const scheduler: Scheduler = time.scheduler;
  return { time, toy, storage, scheduler, ...radio };
}

describe('Bluetooth connector', () => {
  it('scans, connects, remembers the toy, and the client works over BLE', async () => {
    const { toy, storage, manager, calls, time, scheduler } = setup();
    const connector = createBluetoothConnector({ manager, storage, scheduler, requestPermissions: async () => true });
    const transport = await connector.connect();
    expect(calls.scans).toBe(1);
    expect(await storage.getItem(LAST_TOY_STORAGE_KEY)).toBe(TOY_ID);

    const client = await connectFidgetClient(transport, { clock: time.clock, scheduler });
    expect(client.info.capabilities.has('approval')).toBe(true);
    const events: FidgetEvent['type'][] = [];
    client.onEvent((event) => events.push(event.type));
    toy.tap('clicker');
    toy.spin(90);
    expect(events).toEqual(['switchDown', 'switchUp', 'spin']);
    await client.showScore({ score: 120, best: 150, stars: 2 });
    await client.sendScoreEvent({ kind: 'milestone', score: 120, value: 100 });
    expect(toy.lastCelebration).toMatchObject({ kind: 'milestone', score: 120 });

    const drops: (Error | null)[] = [];
    client.onDisconnect((error) => drops.push(error));
    toy.dropConnection(new Error('out of range'));
    expect(drops.map((e) => e?.message)).toEqual(['out of range']);
  });

  it('goes straight to the remembered toy without scanning', async () => {
    const { storage, manager, calls, scheduler } = setup();
    await storage.setItem(LAST_TOY_STORAGE_KEY, TOY_ID);
    await createBluetoothConnector({ manager, storage, scheduler }).connect();
    expect(calls.scans).toBe(0);
    expect(calls.connects).toEqual([TOY_ID]);
  });

  it('falls back to scanning when the remembered toy is gone', async () => {
    const { storage, manager, calls, scheduler } = setup();
    await storage.setItem(LAST_TOY_STORAGE_KEY, 'AA:AA:AA:AA:AA:AA');
    await createBluetoothConnector({ manager, storage, scheduler }).connect();
    expect(calls.connects).toEqual(['AA:AA:AA:AA:AA:AA', TOY_ID]);
    expect(calls.scans).toBe(1);
  });

  it('stops when Bluetooth permission is refused', async () => {
    const { manager, scheduler } = setup();
    const connector = createBluetoothConnector({ manager, scheduler, requestPermissions: async () => false });
    await expect(connector.connect()).rejects.toThrow(BluetoothPermissionError);
  });

  it('gives up when no toy is advertising', async () => {
    const { manager, calls, time, scheduler } = setup({ advertising: false });
    const connecting = createBluetoothConnector({ manager, scheduler, scanTimeoutMs: 5_000 }).connect();
    while (calls.scans === 0) await Promise.resolve();
    time.advance(5_000);
    await expect(connecting).rejects.toThrow(ToyNotFoundError);
  });

  it('waits for Bluetooth to power on before scanning', async () => {
    const { manager, calls, scheduler, setState, stateListeners } = setup({ state: 'Unknown' });
    const connecting = createBluetoothConnector({ manager, scheduler }).connect();
    await Promise.resolve();
    expect(calls.scans).toBe(0);
    setState('PoweredOn');
    await connecting;
    expect(calls.scans).toBe(1);
    expect(stateListeners.size).toBe(0);
  });

  it('reports Bluetooth that is turned off', async () => {
    const { manager, calls, scheduler } = setup({ state: 'PoweredOff' });
    const connecting = createBluetoothConnector({ manager, scheduler }).connect();
    await expect(connecting).rejects.toThrow(BluetoothUnavailableError);
    await expect(connecting).rejects.toMatchObject({ state: 'PoweredOff' });
    expect(calls.scans).toBe(0);
  });

  it('treats an unauthorized radio as refused permission (iOS)', async () => {
    const { manager, scheduler } = setup({ state: 'Unauthorized' });
    await expect(createBluetoothConnector({ manager, scheduler }).connect()).rejects.toThrow(BluetoothPermissionError);
  });

  it('gives up when Bluetooth never becomes ready', async () => {
    const { manager, time, scheduler, stateListeners } = setup({ state: 'Unknown' });
    const connecting = createBluetoothConnector({ manager, scheduler, readyTimeoutMs: 30_000 }).connect();
    await Promise.resolve();
    time.advance(30_000);
    await expect(connecting).rejects.toMatchObject({ name: 'BluetoothUnavailableError', state: 'Unknown' });
    expect(stateListeners.size).toBe(0);
  });
});
