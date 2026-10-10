/**
 * DRV2605L ROM effect ids, checked against the TI datasheet effect list.
 * Add more from that table rather than guessing ids.
 */
export const HapticEffect = {
  strongClick: 1,
  sharpClick: 4,
  softBump: 7,
  doubleClick: 10,
  tripleClick: 12,
  strongBuzz: 14,
  sharpTick: 24,
  buzz: 47,
} as const;

/**
 * Named feedback patterns. Games use these names, not raw effect ids, so the
 * whole app feels the same and can be retuned in one place. Nothing here is
 * meant to feel like a punishment; `nudge` is a gentle "try again".
 */
export const Feedback = {
  tap: [HapticEffect.softBump],
  tick: [HapticEffect.sharpTick],
  success: [HapticEffect.doubleClick],
  celebrate: [HapticEffect.tripleClick, HapticEffect.strongBuzz],
  nudge: [HapticEffect.sharpTick],
} as const satisfies Record<string, readonly number[]>;

export type FeedbackName = keyof typeof Feedback;
