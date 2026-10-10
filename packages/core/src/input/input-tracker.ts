import {
  BATTERY_UNKNOWN,
  FidgetMode,
  InputFlag,
  type InputPacket,
  SHARED_DEFAULTS,
  SPINNER_COUNTS_PER_TURN,
  SWITCH_IDS,
  SwitchBit,
  type SwitchId,
} from '@jimmyit/protocol';
import { type Clock, systemClock } from '../util/time';
import { type FidgetEvent, type FidgetModeState, type FidgetState, INITIAL_FIDGET_STATE } from './types';

export interface InputConfig {
  readonly squeezeRawMin: number;
  readonly squeezeRawMax: number;
  readonly squeezeOnLevel: number;
  readonly squeezeOffLevel: number;
  /** Smallest level change that produces a `squeeze` event. */
  readonly squeezeLevelStep: number;
}

export const DEFAULT_INPUT_CONFIG: InputConfig = {
  ...SHARED_DEFAULTS,
  squeezeLevelStep: 0.02,
};

export interface InputStats {
  readonly packets: number;
  readonly lostPackets: number;
}

/** Turns raw input packets into FidgetState plus FidgetEvents. One per connection. */
export interface InputTracker {
  getState(): FidgetState;
  getStats(): InputStats;
  /** Feeds one packet; returns the events it produced, in order. */
  push(packet: InputPacket): readonly FidgetEvent[];
  reset(): void;
}

export function squeezeLevelFromRaw(raw: number, config: InputConfig = DEFAULT_INPUT_CONFIG): number {
  const span = config.squeezeRawMax - config.squeezeRawMin;
  const level = (raw - config.squeezeRawMin) / span;
  return Math.min(1, Math.max(0, level));
}

export function modeFromWire(mode: number): FidgetModeState {
  if (mode === FidgetMode.standalone) return 'standalone';
  if (mode === FidgetMode.app) return 'app';
  return 'unknown';
}

function signExtend16(value: number): number {
  return (value << 16) >> 16;
}

function angleFromTotal(spinnerTotal: number): number {
  const counts = ((spinnerTotal % SPINNER_COUNTS_PER_TURN) + SPINNER_COUNTS_PER_TURN) % SPINNER_COUNTS_PER_TURN;
  return (counts * 360) / SPINNER_COUNTS_PER_TURN;
}

export function createInputTracker(options: { config?: Partial<InputConfig>; clock?: Clock } = {}): InputTracker {
  const config: InputConfig = { ...DEFAULT_INPUT_CONFIG, ...options.config };
  const clock = options.clock ?? systemClock;

  let state: FidgetState = INITIAL_FIDGET_STATE;
  let previous: InputPacket | null = null;
  let packets = 0;
  let lostPackets = 0;
  // Fidget time unwrapped from the 16-bit timeMs field; used for hold durations.
  let deviceTimeMs = 0;
  let downAtDeviceMs: Partial<Record<SwitchId, number>> = {};
  let squeezeStartDeviceMs = 0;
  let lastEmittedLevel = 0;

  function switchesFrom(bits: number): Record<SwitchId, boolean> {
    const out = { ...INITIAL_FIDGET_STATE.switches };
    for (const id of SWITCH_IDS) out[id] = (bits & (1 << SwitchBit[id])) !== 0;
    return out;
  }

  function buildState(packet: InputPacket, totalDeg: number, position: number, level: number, active: boolean, at: number): FidgetState {
    return {
      mode: modeFromWire(packet.mode),
      switches: switchesFrom(packet.switches),
      spinner: { angleDeg: angleFromTotal(packet.spinnerTotal), totalDeg },
      screw: { position },
      squeeze: { raw: packet.squeezeRaw, level, active },
      batteryPercent: packet.batteryPercent === BATTERY_UNKNOWN ? null : packet.batteryPercent,
      charging: (packet.flags & InputFlag.charging) !== 0,
      clockSet: (packet.flags & InputFlag.clockSet) !== 0,
      standaloneGameRunning: (packet.flags & InputFlag.standaloneGame) !== 0,
      updatedAt: at,
    };
  }

  function pushBaseline(packet: InputPacket, at: number): readonly FidgetEvent[] {
    deviceTimeMs = 0;
    downAtDeviceMs = {};
    for (const id of SWITCH_IDS) {
      if ((packet.switches & (1 << SwitchBit[id])) !== 0) downAtDeviceMs[id] = 0;
    }
    const level = squeezeLevelFromRaw(packet.squeezeRaw, config);
    const active = level >= config.squeezeOnLevel;
    squeezeStartDeviceMs = 0;
    lastEmittedLevel = level;
    state = buildState(packet, 0, 0, level, active, at);
    previous = packet;
    return [];
  }

  function push(packet: InputPacket): readonly FidgetEvent[] {
    const at = clock.now();
    packets++;
    const prev = previous;
    if (prev === null) return pushBaseline(packet, at);

    // A repeated seq is the same packet seen twice (initial read + notify), not a gap.
    if (packet.seq !== prev.seq) lostPackets += (packet.seq - prev.seq - 1) & 0xff;
    deviceTimeMs += (packet.timeMs - prev.timeMs) & 0xffff;
    const events: FidgetEvent[] = [];

    for (const switchId of SWITCH_IDS) {
      const mask = 1 << SwitchBit[switchId];
      const was = (prev.switches & mask) !== 0;
      const is = (packet.switches & mask) !== 0;
      const latched = (packet.pressed & mask) !== 0;
      const down = () => {
        downAtDeviceMs[switchId] = deviceTimeMs;
        events.push({ type: 'switchDown', switchId, at });
      };
      const up = () => {
        const heldMs = deviceTimeMs - (downAtDeviceMs[switchId] ?? deviceTimeMs);
        delete downAtDeviceMs[switchId];
        events.push({ type: 'switchUp', switchId, heldMs, at });
      };
      // `pressed` latches closures shorter than one packet, so replay the
      // shortest sequence of edges consistent with before/after/latched.
      if (!was && is) down();
      else if (was && !is) {
        up();
        if (latched) {
          down();
          up();
        }
      } else if (!was && !is && latched) {
        down();
        up();
      } else if (was && is && latched) {
        up();
        down();
      }
    }

    let totalDeg = state.spinner.totalDeg;
    const spinCounts = (packet.spinnerTotal - prev.spinnerTotal) | 0;
    if (spinCounts !== 0) {
      const deltaDeg = (spinCounts * 360) / SPINNER_COUNTS_PER_TURN;
      totalDeg += deltaDeg;
      events.push({ type: 'spin', deltaDeg, totalDeg, at });
    }

    let position = state.screw.position;
    const screwDelta = signExtend16(packet.screwTotal - prev.screwTotal);
    if (screwDelta !== 0) {
      position += screwDelta;
      events.push({ type: 'screw', deltaDetents: screwDelta, position, at });
    }

    const level = squeezeLevelFromRaw(packet.squeezeRaw, config);
    const reachedEnd = level !== lastEmittedLevel && (level === 0 || level === 1);
    if (Math.abs(level - lastEmittedLevel) >= config.squeezeLevelStep || reachedEnd) {
      lastEmittedLevel = level;
      events.push({ type: 'squeeze', level, at });
    }
    let active = state.squeeze.active;
    if (!active && level >= config.squeezeOnLevel) {
      active = true;
      squeezeStartDeviceMs = deviceTimeMs;
      events.push({ type: 'squeezeStart', level, at });
    } else if (active && level <= config.squeezeOffLevel) {
      active = false;
      events.push({ type: 'squeezeEnd', heldMs: deviceTimeMs - squeezeStartDeviceMs, at });
    }

    if (packet.mode !== prev.mode) {
      events.push({ type: 'modeChange', mode: modeFromWire(packet.mode), at });
    }

    state = buildState(packet, totalDeg, position, level, active, at);
    previous = packet;
    return events;
  }

  return {
    getState: () => state,
    getStats: () => ({ packets, lostPackets }),
    push,
    reset() {
      state = INITIAL_FIDGET_STATE;
      previous = null;
      packets = 0;
      lostPackets = 0;
    },
  };
}
