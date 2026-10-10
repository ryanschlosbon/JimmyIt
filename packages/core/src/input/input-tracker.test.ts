import { type InputPacket, SwitchBit } from '@jimmyit/protocol';
import { describe, expect, it } from 'vitest';
import { createManualTime } from '../util/time';
import { createInputTracker } from './input-tracker';

const BASE: InputPacket = {
  seq: 0,
  mode: 1,
  switches: 0,
  pressed: 0,
  spinnerTotal: 0,
  screwTotal: 0,
  reserved: 0,
  timeMs: 0,
  batteryPercent: 50,
  flags: 0,
};

const CLICKER = 1 << SwitchBit.clicker;
const NAV_UP = 1 << SwitchBit.navLeft;

function setup() {
  const time = createManualTime(1000);
  const tracker = createInputTracker({ clock: time.clock });
  let last = BASE;
  tracker.push(BASE);
  const next = (change: Partial<InputPacket>) => {
    last = { ...last, pressed: 0, ...change, seq: (last.seq + 1) & 0xff };
    return tracker.push(last).map(({ at: _at, ...rest }) => rest);
  };
  return { tracker, next, time };
}

describe('input tracker', () => {
  it('treats the first packet as a baseline with no events', () => {
    const tracker = createInputTracker();
    expect(tracker.push({ ...BASE, switches: CLICKER, spinnerTotal: 999 })).toEqual([]);
    expect(tracker.getState().switches.clicker).toBe(true);
    expect(tracker.getState().spinner.totalDeg).toBe(0);
  });

  it('reports presses with device-timed hold durations', () => {
    const { next } = setup();
    expect(next({ switches: CLICKER, pressed: CLICKER, timeMs: 100 })).toEqual([{ type: 'switchDown', switchId: 'clicker' }]);
    expect(next({ switches: 0, timeMs: 350 })).toEqual([{ type: 'switchUp', switchId: 'clicker', heldMs: 250 }]);
  });

  it('recovers taps shorter than one packet from the pressed latch', () => {
    const { next } = setup();
    expect(next({ pressed: NAV_UP })).toEqual([
      { type: 'switchDown', switchId: 'navLeft' },
      { type: 'switchUp', switchId: 'navLeft', heldMs: 0 },
    ]);
    next({ switches: CLICKER, pressed: CLICKER });
    // Released and pressed again between packets.
    expect(next({ switches: CLICKER, pressed: CLICKER })).toEqual([
      { type: 'switchUp', switchId: 'clicker', heldMs: 0 },
      { type: 'switchDown', switchId: 'clicker' },
    ]);
  });

  it('turns cumulative counters into deltas, across wraparound', () => {
    const { next, tracker } = setup();
    expect(next({ spinnerTotal: 1024 })).toEqual([{ type: 'spin', deltaDeg: 90, totalDeg: 90 }]);
    expect(next({ spinnerTotal: -1024 })).toEqual([{ type: 'spin', deltaDeg: -180, totalDeg: -90 }]);
    expect(tracker.getState().spinner.angleDeg).toBe(270);

    next({ screwTotal: 32766 });
    expect(next({ screwTotal: -32766 })).toEqual([{ type: 'screw', deltaDetents: 4, position: 32770 }]);
  });

  it('counts lost packets from sequence gaps, ignoring repeats', () => {
    const tracker = createInputTracker();
    tracker.push({ ...BASE, seq: 250 });
    tracker.push({ ...BASE, seq: 250 });
    tracker.push({ ...BASE, seq: 253 });
    tracker.push({ ...BASE, seq: 1 });
    expect(tracker.getStats()).toEqual({ packets: 4, lostPackets: 2 + 3 });
  });

  it('reports mode changes and battery state', () => {
    const { next, tracker } = setup();
    expect(next({ mode: 2, batteryPercent: 255, flags: 0b011 })).toEqual([{ type: 'modeChange', mode: 'app' }]);
    expect(tracker.getState()).toMatchObject({ mode: 'app', batteryPercent: null, charging: true, clockSet: true });
  });
});
