import type { ImageSourcePropType } from 'react-native';

/** Replace files in assets/ or set one of these slots to require('../assets/your-image.png'). */
export const APP_ARTWORK: Readonly<{
  introStart: ImageSourcePropType;
  introEnd: ImageSourcePropType;
  jimmyFace: ImageSourcePropType | null;
  jimmyHero: ImageSourcePropType | null;
  drawingCard: ImageSourcePropType | null;
  shapesCard: ImageSourcePropType | null;
  timedCard: ImageSourcePropType | null;
  rewardsCard: ImageSourcePropType | null;
}> = {
  introStart: require('../assets/intro-start.png'),
  introEnd: require('../assets/intro-end.png'),
  jimmyFace: null,
  jimmyHero: null,
  drawingCard: null,
  shapesCard: null,
  timedCard: null,
  rewardsCard: null,
};

// Match the backgrounds in the supplied compositions so portrait screens have no letterbox edges.
export const INTRO_BACKGROUNDS = { start: '#67D0B1', end: '#EF6B62' } as const;
