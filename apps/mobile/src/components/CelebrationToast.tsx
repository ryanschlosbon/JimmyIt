import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { type Celebration, useCelebration } from '@jimmyit/app-kit';
import { Jimmy } from './Jimmy';
import type { Theme } from '../theme';
import { ANIMATIONS, USE_NATIVE_DRIVER, useAnimation } from '../design/motion';
import { FONTS, RADIUS, SPACE, TYPE } from '../design/tokens';

function words(celebration: Celebration): string {
  const { event } = celebration;
  switch (celebration.kind) {
    case 'newBest': return `New high score on Jimmy: ${event.score}!`;
    case 'milestone': return `${event.value} points on Jimmy!`;
    case 'bestAtEnd': return `Your best ever on Jimmy: ${event.score}!`;
  }
}

/**
 * Score moments from games the toy plays by itself. The child is looking at the toy, not the screen, so this is a
 * small strip at the top that never blocks or needs a tap. App games celebrate in their GameScoreBar instead.
 */
export function CelebrationToast({ theme }: { readonly theme: Theme }) {
  const live = useCelebration();
  const celebration = live && live.event.source === 'toy' ? live : null;
  const canSlide = useAnimation('toastSlide');
  const slide = useRef(new Animated.Value(0)).current;

  // ANIMATION(toastSlide)
  useEffect(() => {
    if (!celebration) return;
    slide.setValue(canSlide ? 0 : 1);
    if (canSlide) Animated.timing(slide, { toValue: 1, duration: ANIMATIONS.toastSlide.ms,
      useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [celebration, canSlide, slide]);

  if (!celebration) return null;
  const big = celebration.kind !== 'milestone';
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: SPACE.xxxl * 2,
    alignItems: 'center', paddingHorizontal: SPACE.lg }}>
    <Animated.View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
      maxWidth: 520, paddingVertical: SPACE.sm, paddingLeft: SPACE.sm, paddingRight: SPACE.xl,
      borderRadius: RADIUS.pill, backgroundColor: big ? theme.yellow : theme.surface,
      borderWidth: 2, borderColor: big ? theme.navy : theme.mint, opacity: slide,
      transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }}>
      <Jimmy face size={44} color={theme.mint} />
      <Text style={{ flexShrink: 1, fontFamily: FONTS.display, fontSize: TYPE.subheading,
        color: big ? theme.navy : theme.text }}>{words(celebration)}</Text>
    </Animated.View>
  </View>;
}
