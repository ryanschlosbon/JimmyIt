import {
  ApprovalStatus,
  BasicModeId,
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
  ScoreEventKind,
  type ScoreEventKindName,
  SPINNER_COUNTS_PER_TURN,
  SwitchBit,
  type SwitchId,
} from '@jimmyit/protocol';
import {
  type Clock,
  createEmitter,
  createScoreEventTracker,
  type FidgetTransport,
  type Listener,
  type ScoreEventDraft,
  scoreEventKindFromWire,
  systemClock,
  type Unsubscribe,
} from '@jimmyit/core';

export interface FakeRecordInput {
  readonly modeId: number;
  readonly score: number;
  readonly durationS: number;
  readonly actions?: number;
  readonly completed?: boolean;
}

/** The last score moment the toy celebrated (from the app, or its own game). */
export interface FakeCelebration {
  readonly kind: ScoreEventKindName;
  readonly score: number;
  readonly value: number;
  readonly source: 'app' | 'toy';
  readonly atMs: number;
}

export interface FakeApprovalRequest {
  readonly appId: number;
  readonly name: string;
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
  setBattery(percent: number | null, charging?: boolean): void;
  /** Simulates a standalone game finishing on the toy (record only). */
  finishStandaloneGame(input: FakeRecordInput): number;
  /**
   * Simulates the child playing a whole standalone game on the toy, with live
   * score events to a connected app, then the record. Points per move follow the
   * firmware: Free Play moves are presses (+10 each); Spin Count moves are
   * quarter turns of the spinner or the screw (+5 each).
   */
  playStandaloneGame(input: { readonly modeId: number; readonly moves: number; readonly durationS: number }): number;
  /** The child's answer to "CONNECT TO …?" (same as pressing the right / left menu key). */
  answerApproval(yes: boolean): void;
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
  /** Score events the app asked the toy to celebrate. */
  readonly scoreEvents: readonly FakeCelebration[];
  readonly lastCelebration: FakeCelebration | null;

  // The toy's own state, for simulator panels.
  /** A phone waiting for the child's yes/no, or null. */
  readonly approvalRequest: FakeApprovalRequest | null;
  /** True once the connected phone has been approved. */
  readonly approved: boolean;
  /** True while a client may connect; false after dropConnection(). */
  readonly linked: boolean;
  isClosed(switchId: SwitchId): boolean;
  readonly batteryPercent: number | null;
  /** Standalone games stored on the toy (synced or not). */
  readonly storedRecordCount: number;
  /** Called after any change above: input, display, haptics, mode, link or records. */
  subscribe(listener: Listener<void>): Unsubscribe;
}

export interface FakeFidgetOptions {
  readonly deviceId?: number;
  readonly clock?: Clock;
  readonly firmwareVersion?: readonly [number, number, number];
  readonly protocolVersion?: number;
  /**
   * 'auto' (default, for tests): every phone is approved at once. 'ask': like the
   * real toy, a new phone waits until answerApproval() or a menu key; approved
   * phones are remembered for later connections.
   */
  readonly approval?: 'auto' | 'ask';
}

export function createFakeFidget(options: FakeFidgetOptions = {}): FakeFidget {
  const clock = options.clock ?? systemClock;
  const bootMs = clock.now();
  const deviceId = options.deviceId ?? 0x0000f1d6;
  const [fwMajor, fwMinor, fwPatch] = options.firmwareVersion ?? [0, 1, 0];

  const inputListeners = createEmitter<Uint8Array>();
  const messageListeners = createEmitter<Uint8Array>();
  const disconnectListeners = createEmitter<Error | null>();
  const changes = createEmitter<void>();
  let linkUp = true;

  let seq = 0;
  let switches = 1 << SwitchBit.stylusStowed; // like the real toy: the stylus starts in its bay
  let spinnerTotal = 0;
  let screwTotal = 0;
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
  const approvalMode = options.approval ?? 'auto';
  const knownApps = new Set<number>();
  let approvalRequest: FakeApprovalRequest | null = null;
  let approved = false;
  const scoreEvents: FakeCelebration[] = [];
  let lastCelebration: FakeCelebration | null = null;
  let lines = ['', '', '', ''];
  let score: FakeDisplay['score'] = null;
  let progress: FakeDisplay['progress'] = null;

  function packet(pressed: number): Uint8Array {
    const flags =
      (clockBase ? InputFlag.clockSet : 0) |
      (charging ? InputFlag.charging : 0) |
      (approvalRequest ? InputFlag.awaitingApproval : 0);
    return encodeInputPacket({
      seq,
      mode,
      switches,
      pressed,
      spinnerTotal,
      screwTotal: ((screwTotal << 16) >> 16),
      reserved: 0,
      timeMs: clock.now() & 0xffff,
      batteryPercent,
      flags,
    });
  }

  function notifyInput(pressed = 0): void {
    seq = (seq + 1) & 0xff;
    if (linkUp && approved) inputListeners.emit(packet(pressed));  // only an approved phone gets input
    changes.emit();
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
    if (command.type === 'hello') {
      handleHello(command.appId, command.name);
      return;
    }
    if (!approved) {
      sendMessage(encodeMessage({ type: 'error', code: ErrorCode.notApproved, opcode: CommandOpcode[command.type] }));
      return;
    }
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
      case 'scoreEvent': {
        const kind = scoreEventKindFromWire(command.kind);
        if (!kind) break;
        lastCelebration = { kind, score: command.score, value: command.value, source: 'app', atMs: clock.now() };
        scoreEvents.push(lastCelebration);
        break;
      }
    }
  }

  function sendApproval(status: number): void {
    sendMessage(encodeMessage({ type: 'approval', status }));
  }

  function handleHello(appId: number, name: string): void {
    if (approved || approvalMode === 'auto' || knownApps.has(appId)) {
      approved = true;
      knownApps.add(appId);
      sendApproval(ApprovalStatus.accepted);
      return;
    }
    approvalRequest = { appId, name: name || 'A PHONE' };
    sendApproval(ApprovalStatus.waiting);
  }

  function answer(yes: boolean): void {
    if (!approvalRequest) return;
    const request = approvalRequest;
    approvalRequest = null;
    if (yes) {
      approved = true;
      knownApps.add(request.appId);
      sendApproval(ApprovalStatus.accepted);
      changes.emit();
      return;
    }
    sendApproval(ApprovalStatus.declined);
    changes.emit();
    fake.dropConnection();  // the real toy disconnects after saying no
  }

  // The toy's own game moments: celebrate on the toy and tell an approved app.
  function toyEvent(event: ScoreEventDraft, modeId: number): void {
    lastCelebration = { ...event, source: 'toy', atMs: clock.now() };
    if (approved) {
      sendMessage(encodeMessage({ type: 'scoreEvent', kind: ScoreEventKind[event.kind], modeId, score: event.score, value: event.value }));
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
        capabilities:
          Capability.haptics |
          Capability.display |
          Capability.scoreLog |
          Capability.standaloneModes |
          Capability.scoreEvents |
          Capability.approval,
        newestRecordId: nextRecordId - 1,
        storedRecordCount: records.length,
      });
    },
    async write(_characteristic, bytes) {
      if (!linkUp) throw new Error('fake fidget: link is down');
      handleCommand(bytes);
      changes.emit();
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
      // While the toy asks "connect?", the menu keys answer it (left = no, right = yes).
      if (approvalRequest && (switchId === 'navLeft' || switchId === 'navRight')) {
        answer(switchId === 'navRight');
        return;
      }
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
      if (approved) sendMessage(recordMessage(record));
      changes.emit();
      return record.recordId;
    },
    playStandaloneGame(input) {
      const tracker = createScoreEventTracker(bests.get(input.modeId) ?? 0);
      toyEvent(tracker.start(), input.modeId);
      const pointsPerMove = input.modeId === BasicModeId.spinCount ? 5 : 10;
      for (let move = 1; move <= input.moves; move++) {
        for (const event of tracker.onScore(move * pointsPerMove)) toyEvent(event, input.modeId);
      }
      const end = tracker.end();
      toyEvent(end, input.modeId);
      return fake.finishStandaloneGame({
        modeId: input.modeId,
        score: end.score,
        durationS: input.durationS,
        actions: input.moves,
      });
    },
    answerApproval: (yes) => answer(yes),
    dropConnection(error) {
      if (!linkUp) return;
      linkUp = false;
      mode = FidgetMode.standalone;
      approved = false;
      approvalRequest = null;
      disconnectListeners.emit(error ?? null);
      inputListeners.clear();
      messageListeners.clear();
      disconnectListeners.clear();
      changes.emit();
    },
    reconnect() {
      if (linkUp) return;
      linkUp = true;
      changes.emit();
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
    get linked() {
      return linkUp;
    },
    get approvalRequest() {
      return approvalRequest;
    },
    get approved() {
      return approved;
    },
    scoreEvents,
    get lastCelebration() {
      return lastCelebration;
    },
    isClosed: (switchId) => (switches & (1 << SwitchBit[switchId])) !== 0,
    get batteryPercent() {
      return batteryPercent === BATTERY_UNKNOWN ? null : batteryPercent;
    },
    get storedRecordCount() {
      return records.length;
    },
    subscribe: (listener) => changes.subscribe(listener),
  };
  return fake;
}
