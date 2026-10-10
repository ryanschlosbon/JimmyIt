import {
  Capability,
  type CapabilityName,
  type Command,
  CommandOpcode,
  decodeDeviceInfo,
  decodeInputPacket,
  decodeMessage,
  type DeviceInfo,
  encodeCommand,
  type FidgetMessage,
  FidgetMode,
  type FidgetModeName,
  PROTOCOL_VERSION,
  ProtocolError,
  RecordFlag,
  type RecordMessage,
} from '@jimmyit/protocol';
import { createInputTracker, type InputConfig, type InputStats } from '../input/input-tracker';
import type { FidgetEvent, FidgetState } from '../input/types';
import { formatDeviceId } from '../scoring/score-records';
import type { Stars } from '../scoring/types';
import { createEmitter, type Listener, type Unsubscribe } from '../util/emitter';
import { type Clock, type Scheduler, systemClock, systemScheduler } from '../util/time';
import { Feedback, type FeedbackName } from './feedback';
import type { FidgetTransport } from './transport';

export interface FidgetInfo {
  readonly deviceId: string;
  readonly protocolVersion: number;
  readonly firmwareVersion: string;
  readonly capabilities: ReadonlySet<CapabilityName>;
  readonly newestRecordId: number;
  readonly storedRecordCount: number;
}

/** A finished standalone game as reported by the fidget. */
export interface FidgetRecord {
  readonly recordId: number;
  readonly modeId: number;
  readonly clockSet: boolean;
  readonly completed: boolean;
  readonly newBest: boolean;
  readonly startUnix: number;
  readonly durationMs: number;
  readonly score: number;
  readonly actions: number;
}

export type FidgetDeviceError =
  | { readonly kind: 'fidgetError'; readonly code: number; readonly opcode: number }
  | { readonly kind: 'badPacket'; readonly characteristic: 'input' | 'message'; readonly error: ProtocolError };

export interface ShowScoreOptions {
  readonly score: number;
  readonly best?: number;
  readonly stars?: Stars;
}

/** Everything the app can do with one connected fidget. */
export interface FidgetClient {
  readonly info: FidgetInfo;
  readonly connected: boolean;
  getState(): FidgetState;
  getInputStats(): InputStats;

  onState(listener: Listener<FidgetState>): Unsubscribe;
  onEvent(listener: Listener<FidgetEvent>): Unsubscribe;
  /** Standalone games that finish while connected (not ones from fetchRecords). */
  onRecord(listener: Listener<FidgetRecord>): Unsubscribe;
  onDeviceError(listener: Listener<FidgetDeviceError>): Unsubscribe;
  onDisconnect(listener: Listener<Error | null>): Unsubscribe;

  haptic(...effects: number[]): Promise<void>;
  feedback(name: FeedbackName): Promise<void>;
  showText(line: number, text: string): Promise<void>;
  showScore(options: ShowScoreOptions): Promise<void>;
  showProgress(percent: number, label?: string): Promise<void>;
  clearDisplay(): Promise<void>;
  setMode(mode: FidgetModeName): Promise<void>;
  /** Sends the app's current time so fidget records get real timestamps. */
  syncClock(): Promise<void>;
  setBest(modeId: number, score: number): Promise<void>;

  /** Stored fidget records with recordId > afterRecordId, oldest first. */
  fetchRecords(afterRecordId: number): Promise<readonly FidgetRecord[]>;
  ackRecords(upToRecordId: number): Promise<void>;
  refreshInfo(): Promise<FidgetInfo>;
  disconnect(): Promise<void>;
}

export interface FidgetClientOptions {
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
  readonly input?: Partial<InputConfig>;
  readonly requestTimeoutMs?: number;
  /** Send setTime right after connecting. Default true. */
  readonly syncClockOnConnect?: boolean;
}

export class ProtocolVersionMismatchError extends Error {
  override name = 'ProtocolVersionMismatchError';
  constructor(readonly fidgetVersion: number) {
    super(`fidget speaks protocol v${fidgetVersion}, this app speaks v${PROTOCOL_VERSION}; update the older one`);
  }
}

export class FidgetDisconnectedError extends Error {
  override name = 'FidgetDisconnectedError';
  constructor() {
    super('the fidget is not connected');
  }
}

export class FidgetTimeoutError extends Error {
  override name = 'FidgetTimeoutError';
}

function toFidgetInfo(raw: DeviceInfo): FidgetInfo {
  const capabilities = new Set<CapabilityName>();
  for (const [name, mask] of Object.entries(Capability) as [CapabilityName, number][]) {
    if ((raw.capabilities & mask) !== 0) capabilities.add(name);
  }
  return {
    deviceId: formatDeviceId(raw.deviceId),
    protocolVersion: raw.protocolVersion,
    firmwareVersion: `${raw.firmwareMajor}.${raw.firmwareMinor}.${raw.firmwarePatch}`,
    capabilities,
    newestRecordId: raw.newestRecordId,
    storedRecordCount: raw.storedRecordCount,
  };
}

function toFidgetRecord(message: RecordMessage): FidgetRecord {
  return {
    recordId: message.recordId,
    modeId: message.modeId,
    clockSet: (message.flags & RecordFlag.clockSet) !== 0,
    completed: (message.flags & RecordFlag.completed) !== 0,
    newBest: (message.flags & RecordFlag.newBest) !== 0,
    startUnix: message.startUnix,
    durationMs: message.durationS * 1000,
    score: message.score,
    actions: message.actions,
  };
}

/**
 * Wraps a connected transport: checks the protocol version, starts input
 * tracking and (by default) sends the clock. The caller owns the transport and
 * should disconnect it if this throws.
 */
export async function connectFidgetClient(transport: FidgetTransport, options: FidgetClientOptions = {}): Promise<FidgetClient> {
  const clock = options.clock ?? systemClock;
  const scheduler = options.scheduler ?? systemScheduler;
  const requestTimeoutMs = options.requestTimeoutMs ?? 5000;

  const rawInfo = decodeDeviceInfo(await transport.read('info'));
  if (rawInfo.protocolVersion !== PROTOCOL_VERSION) throw new ProtocolVersionMismatchError(rawInfo.protocolVersion);
  let info = toFidgetInfo(rawInfo);

  const tracker = createInputTracker({ config: options.input ?? {}, clock });
  const states = createEmitter<FidgetState>();
  const events = createEmitter<FidgetEvent>();
  const records = createEmitter<FidgetRecord>();
  const deviceErrors = createEmitter<FidgetDeviceError>();
  const disconnects = createEmitter<Error | null>();

  let connected = true;
  let pendingFetch: {
    afterRecordId: number;
    collected: FidgetRecord[];
    finish(error: Error | null): void;
  } | null = null;

  function handleInput(bytes: Uint8Array): void {
    let produced: readonly FidgetEvent[];
    try {
      produced = tracker.push(decodeInputPacket(bytes));
    } catch (error) {
      if (!(error instanceof ProtocolError)) throw error;
      deviceErrors.emit({ kind: 'badPacket', characteristic: 'input', error });
      return;
    }
    for (const event of produced) events.emit(event);
    states.emit(tracker.getState());
  }

  function handleMessage(bytes: Uint8Array): void {
    let message: FidgetMessage;
    try {
      message = decodeMessage(bytes);
    } catch (error) {
      if (!(error instanceof ProtocolError)) throw error;
      deviceErrors.emit({ kind: 'badPacket', characteristic: 'message', error });
      return;
    }
    switch (message.type) {
      case 'record': {
        const record = toFidgetRecord(message);
        if (!pendingFetch) records.emit(record);
        else if (record.recordId > pendingFetch.afterRecordId) pendingFetch.collected.push(record);
        break;
      }
      case 'syncDone':
        pendingFetch?.finish(null);
        break;
      case 'error':
        deviceErrors.emit({ kind: 'fidgetError', code: message.code, opcode: message.opcode });
        if (message.opcode === CommandOpcode.syncRequest) {
          pendingFetch?.finish(new Error(`fidget rejected syncRequest with error ${message.code}`));
        }
        break;
    }
  }

  // Baseline from the current value before notifications start.
  tracker.push(decodeInputPacket(await transport.read('input')));

  const subscriptions: Unsubscribe[] = [
    transport.subscribe('input', handleInput),
    transport.subscribe('message', handleMessage),
  ];
  subscriptions.push(
    transport.onDisconnect((error) => {
      if (!connected) return;
      teardown();
      disconnects.emit(error);
    }),
  );

  function teardown(): void {
    connected = false;
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    pendingFetch?.finish(new FidgetDisconnectedError());
  }

  async function send(command: Command): Promise<void> {
    if (!connected) throw new FidgetDisconnectedError();
    await transport.write('command', encodeCommand(command));
  }

  const client: FidgetClient = {
    get info() {
      return info;
    },
    get connected() {
      return connected;
    },
    getState: () => tracker.getState(),
    getInputStats: () => tracker.getStats(),

    onState: (listener) => states.subscribe(listener),
    onEvent: (listener) => events.subscribe(listener),
    onRecord: (listener) => records.subscribe(listener),
    onDeviceError: (listener) => deviceErrors.subscribe(listener),
    onDisconnect: (listener) => disconnects.subscribe(listener),

    haptic: (...effects) => send({ type: 'haptic', effects }),
    feedback: (name) => send({ type: 'haptic', effects: Feedback[name] }),
    showText: (line, text) => send({ type: 'showText', line, text }),
    showScore: ({ score, best = 0, stars = 0 }) => send({ type: 'showScore', score, best, stars }),
    showProgress: (percent, label = '') => send({ type: 'showProgress', percent: Math.round(percent), label }),
    clearDisplay: () => send({ type: 'clearDisplay' }),
    setMode: (mode) => send({ type: 'setMode', mode: FidgetMode[mode] }),
    syncClock: () => send({ type: 'setTime', unixSeconds: Math.floor(clock.now() / 1000) }),
    setBest: (modeId, score) => send({ type: 'setBest', modeId, score }),

    fetchRecords(afterRecordId) {
      if (pendingFetch) return Promise.reject(new Error('a record fetch is already running'));
      return new Promise<readonly FidgetRecord[]>((resolve, reject) => {
        const collected: FidgetRecord[] = [];
        const cancelTimeout = scheduler.after(requestTimeoutMs, () =>
          request.finish(new FidgetTimeoutError(`no syncDone within ${requestTimeoutMs} ms`)),
        );
        const request = {
          afterRecordId,
          collected,
          finish(error: Error | null) {
            if (pendingFetch !== request) return;
            pendingFetch = null;
            cancelTimeout();
            if (error) reject(error);
            else resolve(collected);
          },
        };
        pendingFetch = request;
        send({ type: 'syncRequest', afterRecordId }).catch((error: Error) => request.finish(error));
      });
    },
    ackRecords: (upToRecordId) => send({ type: 'syncAck', upToRecordId }),

    async refreshInfo() {
      info = toFidgetInfo(decodeDeviceInfo(await transport.read('info')));
      return info;
    },
    async disconnect() {
      if (!connected) return;
      teardown();
      await transport.disconnect();
      disconnects.emit(null);
    },
  };

  if (options.syncClockOnConnect ?? true) await client.syncClock();
  return client;
}
