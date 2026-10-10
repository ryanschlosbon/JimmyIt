import type { Stars } from './types';

/** Minimum score for 1, 2 and 3 stars. */
export type StarThresholds = readonly [oneStar: number, twoStars: number, threeStars: number];

export function starsFor(score: number, thresholds: StarThresholds): Stars {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

/**
 * Partial credit for getting close: full points at the target, falling
 * linearly to 0 at `tolerance` away. Always a non-negative integer.
 */
export function proximityPoints(options: { value: number; target: number; tolerance: number; maxPoints: number }): number {
  const { value, target, tolerance, maxPoints } = options;
  if (!(tolerance > 0)) throw new RangeError(`tolerance must be > 0, got ${tolerance}`);
  const closeness = 1 - Math.abs(value - target) / tolerance;
  return Math.max(0, Math.round(maxPoints * closeness));
}

/** Whole points for time spent doing something, e.g. holding the slider at one end. */
export function pointsForDuration(durationMs: number, pointsPerSecond: number): number {
  return Math.max(0, Math.floor((durationMs / 1000) * pointsPerSecond));
}

/** Rewards streaks without punishing misses: a miss only resets the bonus. */
export interface Combo {
  readonly streak: number;
  readonly multiplier: number;
  /** Records a success and returns the multiplier to apply to it. */
  hit(): number;
  reset(): void;
}

export function createCombo(options: { hitsPerStep?: number; maxMultiplier?: number } = {}): Combo {
  const hitsPerStep = options.hitsPerStep ?? 3;
  const maxMultiplier = options.maxMultiplier ?? 4;
  let streak = 0;
  const multiplierFor = (n: number) => Math.min(maxMultiplier, 1 + Math.floor(n / hitsPerStep));
  return {
    get streak() {
      return streak;
    },
    get multiplier() {
      return multiplierFor(streak);
    },
    hit() {
      const multiplier = multiplierFor(streak);
      streak++;
      return multiplier;
    },
    reset() {
      streak = 0;
    },
  };
}
