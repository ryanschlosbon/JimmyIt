import { describe, expect, it } from 'vitest';
import { createToyActionTracker } from './toy-actions';
import type { FidgetEvent } from './types';

const at = 0;

describe('toy actions', () => {
  it('maps each control to one kind of move', () => {
    const tracker = createToyActionTracker();
    const events: FidgetEvent[] = [
      { type: 'switchDown', switchId: 'clicker', at },
      { type: 'switchUp', switchId: 'clicker', heldMs: 80, at },
      { type: 'switchDown', switchId: 'navRight', at },
      { type: 'switchDown', switchId: 'screwPush', at },
      { type: 'switchDown', switchId: 'rocker', at },
      { type: 'switchUp', switchId: 'rocker', heldMs: 0, at },
      { type: 'switchDown', switchId: 'sliderLow', at },
      { type: 'switchUp', switchId: 'stylusStowed', heldMs: 0, at },
      { type: 'switchDown', switchId: 'stylusStowed', at },
      { type: 'switchDown', switchId: 'screwHome', at },
      { type: 'screw', deltaDetents: -12, position: -12, at }, // two quarter turns
      { type: 'modeChange', mode: 'app', at },
    ];
    expect(events.flatMap((event) => tracker.onEvent(event))).toEqual([
      'press', 'press', 'press', 'toggle', 'toggle', 'slide', 'stylus', 'screw', 'screw',
    ]);
  });

  it('counts spins from the last counted position, in either direction', () => {
    const tracker = createToyActionTracker({ spinStepDeg: 90 });
    let totalDeg = 0;
    const spin = (deltaDeg: number) => {
      totalDeg += deltaDeg;
      return tracker.onEvent({ type: 'spin', deltaDeg, totalDeg, at });
    };
    expect(spin(60)).toEqual([]);
    expect(spin(40)).toEqual(['spin']); // 100° from the start; counted position is now 90°
    expect(spin(200)).toEqual(['spin', 'spin']); // 300°: counted up to 270°
    expect(spin(-150)).toEqual(['spin']); // back to 150°: counted down to 180°
    tracker.reset();
    expect(spin(80)).toEqual([]);
    expect(() => createToyActionTracker({ spinStepDeg: 0 })).toThrow(RangeError);
  });

  it('counts a screw move per quarter turn (6 detents) from the last counted position', () => {
    const tracker = createToyActionTracker();
    let position = 0;
    const turn = (deltaDetents: number) => {
      position += deltaDetents;
      return tracker.onEvent({ type: 'screw', deltaDetents, position, at });
    };
    expect(turn(1)).toEqual([]);
    expect(turn(4)).toEqual([]);
    expect(turn(1)).toEqual(['screw']); // 6 detents: a quarter turn
    expect(turn(13)).toEqual(['screw', 'screw']); // 19: counted up to 18
    expect(turn(-6)).toEqual([]); // back to 13: 5 below the counted 18
    expect(turn(-1)).toEqual(['screw']); // 12
    for (let i = 0; i < 100; i++) expect(turn(i % 2 === 0 ? 1 : -1)).toEqual([]); // wiggling one detent
    expect(() => createToyActionTracker({ screwStepDetents: 0 })).toThrow(RangeError);
  });

  it('ignores sensor jitter around one spot', () => {
    const tracker = createToyActionTracker({ spinStepDeg: 90 });
    let totalDeg = 0;
    let spins = 0;
    for (let i = 0; i < 10_000; i++) {
      const deltaDeg = i % 2 === 0 ? 0.1 : -0.1;
      totalDeg += deltaDeg;
      spins += tracker.onEvent({ type: 'spin', deltaDeg, totalDeg, at }).length;
    }
    expect(spins).toBe(0);
  });
});
