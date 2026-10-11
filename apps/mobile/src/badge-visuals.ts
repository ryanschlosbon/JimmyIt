import type { BadgeId } from '@jimmyit/app-kit';
import type { IconName } from './components/Icon';

type BadgeColor = 'coral' | 'mint' | 'pink' | 'yellow' | 'teal' | 'purple';

/** Design-side look of each badge; which badges exist and their counts come from app-kit. */
export const BADGE_VISUALS: Readonly<Record<BadgeId, {
  readonly icon: IconName;
  readonly color: BadgeColor;
  readonly unlockHint: (goal: number) => string;
}>> = {
  first: { icon: 'sparkle', color: 'coral', unlockHint: () => 'Finish your first game.' },
  shapes: { icon: 'shapes', color: 'mint', unlockHint: () => 'Finish a Shape Challenge game.' },
  buttons: { icon: 'toy', color: 'pink', unlockHint: goal => `Press Jimmy’s buttons ${goal} times in Timed Run.` },
  spinner: { icon: 'spin', color: 'yellow',
    unlockHint: goal => `Make ${goal} spins in Timed Run or Spin Count on Jimmy.` },
  drawing: { icon: 'pencil', color: 'teal', unlockHint: goal => `Save ${goal} pictures in Drawing.` },
  week: { icon: 'flame', color: 'purple', unlockHint: goal => `Play a game each day for ${goal} days in a row.` },
};
