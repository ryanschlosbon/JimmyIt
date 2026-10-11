// Every sound in the app is listed here, by name. The files in assets/sounds are
// made by scripts/generate-sounds.py (same names); to change how one sounds,
// edit its numbers there and run the script. To change *when* one plays, edit
// the tables below. DESIGN.md "Sound" explains the rules.
//
// One sound per moment: when several are asked for at once (a press that scores,
// reaches a milestone and beats the best), only the highest `priority` plays.
import type { FeedbackName } from '@jimmyit/game-sdk';

export const SOUND_NAMES = ['click', 'pop1', 'pop2', 'pop3', 'tap', 'tick', 'nudge', 'success', 'start', 'milestone',
  'celebrate', 'finish', 'levelUp', 'badge'] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

export interface SoundStyle {
  /** When sounds are asked for together, the highest priority plays and the rest are dropped. */
  readonly priority: number;
  /** The same sound won't repeat sooner than this, so fast play never turns into a buzz. */
  readonly gapMs: number;
  /** For this long after it starts, quieter game sounds (lower priority, above 0) are skipped. */
  readonly holdMs: number;
}

export const SOUNDS: Readonly<Record<SoundName, SoundStyle>> = {
  /** Every button press. Priority 0: never held back by a celebration, so a press always answers. */
  click: { priority: 0, gapMs: 30, holdMs: 0 },
  /** Points. Three pitches, taken in turn. */
  pop1: { priority: 1, gapMs: 60, holdMs: 0 },
  pop2: { priority: 1, gapMs: 60, holdMs: 0 },
  pop3: { priority: 1, gapMs: 60, holdMs: 0 },
  tap: { priority: 1, gapMs: 60, holdMs: 0 },
  tick: { priority: 1, gapMs: 45, holdMs: 0 },
  /** A soft "try again". Never a buzzer. */
  nudge: { priority: 2, gapMs: 250, holdMs: 0 },
  success: { priority: 3, gapMs: 120, holdMs: 120 },
  start: { priority: 3, gapMs: 300, holdMs: 0 },
  finish: { priority: 4, gapMs: 500, holdMs: 300 },
  milestone: { priority: 5, gapMs: 300, holdMs: 250 },
  celebrate: { priority: 6, gapMs: 600, holdMs: 450 },
  badge: { priority: 7, gapMs: 600, holdMs: 500 },
  levelUp: { priority: 7, gapMs: 600, holdMs: 500 },
};

/** The sound for each Feedback name a game asks for (the toy plays the matching haptic). */
export const FEEDBACK_SOUNDS: Readonly<Record<FeedbackName, SoundName>> = {
  tap: 'tap',
  tick: 'tick',
  success: 'success',
  celebrate: 'celebrate',
  nudge: 'nudge',
  levelUp: 'levelUp',
  badge: 'badge',
};

/** Points take these in turn. */
export const POP_SOUNDS: readonly SoundName[] = ['pop1', 'pop2', 'pop3'];
