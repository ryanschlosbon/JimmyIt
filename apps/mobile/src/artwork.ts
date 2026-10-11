import type { ImageSourcePropType } from 'react-native';
import type { ShelfGameId } from './games';

/** Replace files in assets/ or set one of these slots to require('../assets/your-image.png'). */
export const APP_ARTWORK: Readonly<{
  introStart: ImageSourcePropType;
  introEnd: ImageSourcePropType;
  jimmyFace: ImageSourcePropType | null;
  jimmyHero: ImageSourcePropType | null;
  settingsGrownUps: ImageSourcePropType;
  settingsJimmy: ImageSourcePropType;
  rewardsBanner: ImageSourcePropType;
  /** Pictures for the play-screen banners; null uses the built-in drawing (components/GameArt.tsx). */
  bannerArt: Readonly<Record<ShelfGameId, ImageSourcePropType | null>>;
}> = {
  introStart: require('../assets/intro-start.png'),
  introEnd: require('../assets/intro-end.png'),
  jimmyFace: null,
  jimmyHero: null,
  settingsGrownUps: require('../assets/grown-ups.png'),
  settingsJimmy: require('../assets/settings-jimmy.png'),
  rewardsBanner: require('../assets/rewards-banner.png'),
  bannerArt: { timed: null, tapQuest: null, drawing: null, shapes: null },
};

// Match the backgrounds in the supplied compositions so portrait screens have no letterbox edges.
export const INTRO_BACKGROUNDS = { start: '#67D0B1', end: '#EF6B62' } as const;
