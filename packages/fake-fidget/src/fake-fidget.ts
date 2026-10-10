import {
  BATTERY_UNKNOWN,
  Capability,
  type Command,
  CommandOpcode,
  decodeCommand,
  encodeDeviceInfo,
  encodeInputPacket,
  encodeMessage,
  ErrorCode,
  FidgetMode,
  type FidgetModeName,
  InputFlag,
  PROTOCOL_VERSION,
  ProtocolError,
  RecordFlag,
  SHARED_DEFAULTS,
  SPINNER_COUNTS_PER_TURN,
  SwitchBit,
  type SwitchId,
} from '@jimmyit/protocol';
import { type Clock, createEmitter, type FidgetTransport, systemClock } from '@jimmyit/core';

export interface FakeRecordInput {
  readonly modeId: number;
  readonly score: number;
  readonly durationS: number;
  readonly actions?: number;
  readonly completed?: boolean;
}

export interface FakeDisplay {
  readonly lines: readonly string[];
  readonly score: { readonly score: number; readonly best: number; readonly stars: number } | null;
  readonly progress: { readonly percent: number; readonly label: string } | null;
}

/**
 * A simulated fidget that speaks the real wire protocol. Frontend screens and
 * games run against it with no hardware; tests use it to drive input.
 */
export interface FakeFidget {
  /** Pass to connectFidgetClient() exactly like a BLE transport. */
  readonly transport: FidgetTransport;

  // Controls (each sends one input notification, like the firmware would).
  press(switchId: SwitchId): void;
  release(switchId: SwitchId): void;
  /** A press and release shorter than one packet; exercises the `pressed` latch. */
  tap(switchId: SwitchId): void;
  /** Positive = clockwise. */
  spin(degrees: number): void;
  /** Positive = tighten. */
  turnScrew(detents: number): void;
  /** 0 = released, 1 = full squeeze. */
  squeeze(level: number): void;
  setBattery(percent: number | null, charging?: boolean): void;
  /** Simulates a standalone game finishing on the toy. */
  finishStandaloneGame(input: FakeRecordInput): number;
  /** Simulates the BLE link dropping. The fidget falls back to standalone mode. */
  dropConnection(error?: Error): void;
  /** Brings the link back so a new client can connect. */
  reconnect(): void;

  // What the app has told the toy to do.
  readonly mode: FidgetModeName;
  readonly display: FakeDisplay;
  readonly haptics: readonly (readonly number[])[];
  readonly commands: readonly Command[];
  readonly bests: ReadonlyMap<number, number>;
  readonly ackedRecordId: number;
  readonly clockUnixSeconds: number | null;
}

export interface FakeFidgetOptions {
  readonly deviceId?: number;
  readonly clock?: Clock;
  readonly firmwareVersion?: readonly [number, number, number];
  readonly protocolVersion?: number;
}

export function createFakeFidget(options: FakeFidgetOptions = {}): FakeFidget {
  const clock = options.clock ?? systemClock;
  const bootMs = clock.now();
  const deviceId = options.deviceId ?? 0x0000f1d6;
  const [fwMajor, fwMinor, fwPatch] = options.firmwareVersion ?? [0, 1, 0];

  const inputListeners = createEmitter<Uint8Array>();
  const messageListeners = createEmitter<Uint8Array>();
  const disconnectListeners = createEmitter<Error | null>();
  let linkUp = true;

  let seq = 0;
  let switches = 0;
  let spinnerTotal = 0;
  let screwTotal = 0;
  let squeezeRaw = 0;
  let batteryPercent = 80;
  let charging = false;
  let mode: number = FidgetMode.standalone;
  // Fidget-side wall clock: unix seconds at the clock.now() it was set.
  let clockBase: { unixSeconds: number; atMs: number } | null = null;

  const records: { recordId: number; modeId: number; flags: number; startUnix: number; durationS: number; score: number; actions: number }[] = [];
  let nextRecordId = 1;
  let ackedRecordId = 0;
  const bests = new Map<number, number>();
  const haptics: number[][] = [];
  const commands: Command[] = [];
  let lines = ['', '', '', ''];
  let score: FakeDisplay['score'] = null;
  let progress: FakeDisplay['progress'] = null;

  function packet(pressed: number): Uint8Array {
    const flags = (clockBase ? InputFlag.clockSet : 0) | (charging ? InputFlag.charging : 0);
    return encodeInputPacket({
      seq,
      mode,
      switches,
      pressed,
      spinnerTotal,
      screwTotal: ((screwTotal << 16) >> 16),
      squeezeRaw,
      timeMs: clock.now() & 0xffff,
      batteryPercent,
      flags,
    });
  }

  function notifyInput(pressed = 0): void {
    seq = (seq + 1) & 0xff;
    if (linkUp) inputListeners.emit(packet(pressed));
  }

  function sendMessage(bytes: Uint8Array): void {
    if (linkUp) messageListeners.emit(bytes);
  }

  /** Real Unix time once the app has sent setTime; seconds since boot before that, like the firmware. */
  function nowUnix(): number {
    if (!clockBase) return Math.floor((clock.now() - bootMs) / 1000);
    return clockBase.unixSeconds + Math.floor((clock.now() - clockBase.atMs) / 1000);
  }

  function recordMessage(r: (typeof records)[number]): Uint8Array {
    return encodeMessage({ type: 'record', ...r });
  }

  function handleCommand(bytes: Uint8Array): void {
    let command: Command;
    try {
      command = decodeCommand(bytes);
    } catch (error) {
      if (!(error instanceof ProtocolError)) throw error;
      const opcode = bytes[0] ?? 0;
      const known = (Object.values(CommandOpcode) as number[]).includes(opcode);
      sendMessage(encodeMessage({ type: 'error', code: known ? ErrorCode.badLength : ErrorCode.unknownOpcode, opcode }));
      return;
    }
    commands.push(command);
    const appOwnsDisplay = mode === FidgetMode.app;
    switch (command.type) {
      case 'setTime':
        clockBase = { unixSeconds: command.unixSeconds, atMs: clock.now() };
        break;
      case 'setMode':
        mode = command.mode;
        notifyInput();
        break;
      case 'haptic':
        haptics.push([...command.effects]);
        break;
      case 'showText':
        if (appOwnsDisplay) lines = lines.map((line, i) => (i === command.line ? command.text : line));
        break;
      case 'showScore':
        if (appOwnsDisplay) score = { score: command.score, best: command.best, stars: command.stars };
        break;
      case 'showProgress':
        if (appOwnsDisplay) progress = { percent: command.percent, label: command.label };
        break;
      case 'clearDisplay':
        if (appOwnsDisplay) {
          lines = ['', '', '', ''];
          score = null;
          progress = null;
        }
        break;
      case 'syncRequest': {
        const toSend = records.filter((r) => r.recordId > command.afterRecordId);
        for (const r of toSend) sendMessage(recordMessage(r));
        sendMessage(encodeMessage({ type: 'syncDone', newestRecordId: nextRecordId - 1, sentCount: toSend.length }));
        break;
      }
      case 'syncAck':
        ackedRecordId = Math.max(ackedRecordId, command.upToRecordId);
        break;
      case 'setBest':
        bests.set(command.modeId, Math.max(bests.get(command.modeId) ?? 0, command.score));
        break;
    }
  }

  function setSwitchBit(switchId: SwitchId, closed: boolean): void {
    const mask = 1 << SwitchBit[switchId];
    switches = closed ? switches | mask : switches & ~mask;
  }

  const transport: FidgetTransport = {
    async read(characteristic) {
      if (!linkUp) throw new Error('fake fidget: link is down');
      if (characteristic === 'input') return packet(0);
      return encodeDeviceInfo({
        protocolVersion: options.protocolVersion ?? PROTOCOL_VERSION,
        firmwareMajor: fwMajor,
        firmwareMinor: fwMinor,
        firmwarePatch: fwPatch,
        deviceId,
        capabilities: Capability.haptics | Capability.display | Capability.scoreLog | Capability.standaloneModes,
        newestRecordId: nextRecordId - 1,
        storedRecordCount: records.length,
      });
    },
    async write(_characteristic, bytes) {
      if (!linkUp) throw new Error('fake fidget: link is down');
      handleCommand(bytes);
    },
    subscribe(characteristic, listener) {
      return (characteristic === 'input' ? inputListeners : messageListeners).subscribe(listener);
    },
    onDisconnect(listener) {
      return disconnectListeners.subscribe(listener);
    },
    async disconnect() {
      fake.dropConnection();
    },
  };

  const fake: FakeFidget = {
    transport,
    press(switchId) {
      setSwitchBit(switchId, true);
      notifyInput(1 << SwitchBit[switchId]);
    },
    release(switchId) {
      setSwitchBit(switchId, false);
      notifyInput();
    },
    tap(switchId) {
      notifyInput(1 << SwitchBit[switchId]);
    },
    spin(degrees) {
      spinnerTotal = (spinnerTotal + Math.round((degrees * SPINNER_COUNTS_PER_TURN) / 360)) | 0;
      notifyInput();
    },
    turnScrew(detents) {
      screwTotal += Math.round(detents);
      notifyInput();
    },
    squeeze(level) {
      const clamped = Math.min(1, Math.max(0, level));
      squeezeRaw = Math.round(SHARED_DEFAULTS.squeezeRawMin + clamped * (SHARED_DEFAULTS.squeezeRawMax - SHARED_DEFAULTS.squeezeRawMin));
      notifyInput();
    },
    setBattery(percent, isCharging = false) {
      batteryPercent = percent === null ? BATTERY_UNKNOWN : Math.round(percent);
      charging = isCharging;
      notifyInput();
    },
    finishStandaloneGame(input) {
      const previousBest = bests.get(input.modeId) ?? 0;
      const record = {
        recordId: nextRecordId++,
        modeId: input.modeId,
        flags:
          (clockBase ? RecordFlag.clockSet : 0) |
          ((input.completed ?? true) ? RecordFlag.completed : 0) |
          (input.score > previousBest ? RecordFlag.newBest : 0),
        startUnix: Math.max(0, nowUnix() - input.durationS),
        durationS: input.durationS,
        score: input.score,
        actions: input.actions ?? 0,
      };
      records.push(record);
      if (input.score > previousBest) bests.set(input.modeId, input.score);
      sendMessage(recordMessage(record));
      return record.recordId;
    },
    dropConnection(error) {
      if (!linkUp) return;
      linkUp = false;
      mode = FidgetMode.standalone;
      disconnectListeners.emit(error ?? null);
      inputListeners.clear();
      messageListeners.clear();
      disconnectListeners.clear();
    },
    reconnect() {
      linkUp = true;
    },

    get mode() {
      return mode === FidgetMode.app ? 'app' : 'standalone';
    },
    get display() {
      return { lines, score, progress };
    },
    haptics,
    commands,
    bests,
    get ackedRecordId() {
      return ackedRecordId;
    },
    get clockUnixSeconds() {
      return clockBase ? nowUnix() : null;
    },
  };
  return fake;
}
