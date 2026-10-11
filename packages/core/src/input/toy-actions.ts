import { SCREW_DETENTS_PER_TURN } from '@jimmyit/protocol';
import type { FidgetEvent } from './types';

/**
 * One discrete hand movement on the toy. Games, rewards and the toy's own Free
 * Play all count "moves" in these units, so every part of the app agrees on
 * what one move is.
 */
export type ToyAction = 'press' | 'spin' | 'screw' | 'slide' | 'toggle' | 'stylus';

export const TOY_ACTIONS: readonly ToyAction[] = ['press', 'spin', 'screw', 'slide', 'toggle', 'stylus'];

export interface ToyActionOptions {
  /**
   * Spinner rotation that counts as one spin, either direction. Default 90°.
   * Measured from the last counted position (as the firmware does), so sensor
   * jitter around one spot never adds up to a spin.
   */
  readonly spinStepDeg?: number;
  /**
   * Captive-screw detents that count as one screw move, either direction.
   * Default 6, a quarter turn of the 24-detent encoder. Measured from the last
   * counted position like spins, so turning back and forth by a detent never adds up.
   */
  readonly screwStepDetents?: number;
}

/** Turns raw FidgetEvents into ToyActions. Keep one per game run. */
export interface ToyActionTracker {
  /** Returns the actions this event completed, possibly none or several. */
  onEvent(event: FidgetEvent): readonly ToyAction[];
  reset(): void;
}

export function createToyActionTracker(options: ToyActionOptions = {}): ToyActionTracker {
  const spinStepDeg = options.spinStepDeg ?? 90;
  const screwStepDetents = options.screwStepDetents ?? SCREW_DETENTS_PER_TURN / 4;
  if (!(spinStepDeg > 0)) throw new RangeError(`spinStepDeg must be > 0, got ${spinStepDeg}`);
  if (!(screwStepDetents > 0)) throw new RangeError(`screwStepDetents must be > 0, got ${screwStepDetents}`);
  let anchorDeg: number | null = null;
  let screwAnchor: number | null = null;

  return {
    onEvent(event) {
      switch (event.type) {
        case 'switchDown':
          switch (event.switchId) {
            case 'clicker':
            case 'navLeft':
            case 'navRight':
            case 'screwPush':
              return ['press'];
            case 'rocker':
              return ['toggle'];
            case 'sliderLow':
            case 'sliderHigh':
              return ['slide'];
            default:
              return []; // screw limit switches and stylus seating are not moves by themselves
          }
        case 'switchUp':
          if (event.switchId === 'rocker') return ['toggle']; // the rocker latches: both directions are a move
          if (event.switchId === 'stylusStowed') return ['stylus']; // stylus taken out
          return [];
        case 'spin': {
          const anchor = anchorDeg ?? event.totalDeg - event.deltaDeg;
          const offset = event.totalDeg - anchor;
          const spins = Math.floor(Math.abs(offset) / spinStepDeg);
          anchorDeg = anchor + Math.sign(offset) * spins * spinStepDeg;
          return Array<ToyAction>(spins).fill('spin');
        }
        case 'screw': {
          const anchor = screwAnchor ?? event.position - event.deltaDetents;
          const offset = event.position - anchor;
          const turns = Math.floor(Math.abs(offset) / screwStepDetents);
          screwAnchor = anchor + Math.sign(offset) * turns * screwStepDetents;
          return Array<ToyAction>(turns).fill('screw');
        }
        default:
          return [];
      }
    },
    reset() {
      anchorDeg = null;
      screwAnchor = null;
    },
  };
}
