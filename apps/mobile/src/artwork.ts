import type { ImageSourcePropType } from 'react-native';
import type { ShelfGameId } from './games';

/** Replace files in assets/ or set one of these slots to require('../assets/your-image.png'). */
export const APP_ARTWORK: Readonly<{
  /** Jimmy's round face for the opening animation; transparent outside the circle. */
  introFace: ImageSourcePropType;
  /** The "JimmyIt" wordmark for the opening animation, on a transparent background. */
  introWordmark: ImageSourcePropType;
  jimmyFace: ImageSourcePropType | null;
  jimmyHero: ImageSourcePropType | null;
  settingsGrownUps: ImageSourcePropType;
  settingsJimmy: ImageSourcePropType;
  rewardsBanner: ImageSourcePropType;
  /** Pictures for the play-screen banners; null uses the built-in drawing (components/GameArt.tsx). */
  bannerArt: Readonly<Record<ShelfGameId, ImageSourcePropType | null>>;
}> = {
  introFace: require('../assets/intro-face.png'),
  introWordmark: require('../assets/intro-wordmark.png'),
  jimmyFace: null,
  jimmyHero: null,
  settingsGrownUps: require('../assets/grown-ups.png'),
  settingsJimmy: require('../assets/settings-jimmy.png'),
  rewardsBanner: require('../assets/rewards-banner.png'),
  bannerArt: { timed: null, tapQuest: null, drawing: null, shapes: null, buttonHero: null, knobQuest: null },
};

// The opening animation's mint background and the coral that closes in around Jimmy.
export const INTRO_BACKGROUNDS = { start: '#67D0B1', end: '#EF6B62' } as const;

/**
 * Where the intro pieces sit in the 1280 × 800 composition they were cut from, in its pixels. The
 * composition is shown whole (contain sizing), so change these if a replacement picture moves things.
 */
export const INTRO_LAYOUT = {
  width: 1280,
  height: 800,
  /** The face circle; intro-face.png is `imageSize` square, centered on it. */
  face: { centerX: 300, centerY: 400, radius: 227.5, imageSize: 458 },
  wordmark: { x: 638, y: 362, width: 338, height: 93 },
} as const;
