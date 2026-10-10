import type { BadgeId } from '@jimmyit/app-kit';
import type { IconName } from './components/Icon';

type BadgeColor = 'coral' | 'mint' | 'pink' | 'yellow' | 'teal' | 'purple';

/** Design-side look of each badge; which badges exist and their counts come from app-kit. */
export const BADGE_VISUALS: Readonly<Record<BadgeId, { readonly icon: IconName; readonly color: BadgeColor }>> = {
  first: { icon: 'sparkle', color: 'coral' },
  shapes: { icon: 'shapes', color: 'mint' },
  buttons: { icon: 'toy', color: 'pink' },
  spinner: { icon: 'spin', color: 'yellow' },
  drawing: { icon: 'pencil', color: 'teal' },
  week: { icon: 'flame', color: 'purple' },
};
