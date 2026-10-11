import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import type { Reward } from '@jimmyit/app-kit';
import { Icon } from './Icon';
import { BADGE_VISUALS } from '../badge-visuals';
import type { Theme } from '../theme';
import { ANIMATIONS, USE_NATIVE_DRIVER, useAnimation } from '../design/motion';
import { FONTS, RADIUS, SPACE, TYPE } from '../design/tokens';

/**
 * A level-up or a new badge. It sits at the bottom of the screen, so it never covers the score at the top, and it
 * never blocks or needs a tap. The toy plays its own strong buzz for the same moment.
 */
export function RewardToast({ theme, reward, badgeLabel }: {
  readonly theme: Theme; readonly reward: Reward | null;
  /** The badge's name, from app-kit's progress. */
  readonly badgeLabel: (badgeId: Extract<Reward, { type: 'badge' }>['badgeId']) => string;
}) {
  const canSlide = useAnimation('toastSlide');
  const slide = useRef(new Animated.Value(0)).current;

  // ANIMATION(toastSlide)
  useEffect(() => {
    if (!reward) return;
    slide.setValue(canSlide ? 0 : 1);
    if (canSlide) Animated.timing(slide, { toValue: 1, duration: ANIMATIONS.toastSlide.ms,
      useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [reward, canSlide, slide]);

  if (!reward) return null;
  const badge = reward.type === 'badge' ? BADGE_VISUALS[reward.badgeId] : null;
  const words = reward.type === 'levelUp' ? `Level ${reward.level}! You leveled up!`
    : `New badge: ${badgeLabel(reward.badgeId)}!`;
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: SPACE.xxl,
    alignItems: 'center', paddingHorizontal: SPACE.lg }}>
    <Animated.View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
      maxWidth: 560, paddingVertical: SPACE.sm, paddingLeft: SPACE.sm, paddingRight: SPACE.xl,
      borderRadius: RADIUS.pill, backgroundColor: theme.yellow, borderWidth: 2, borderColor: theme.navy, opacity: slide,
      transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <View style={{ width: 48, height: 48, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center',
        backgroundColor: badge ? theme[badge.color] : theme.surface, borderWidth: 2, borderColor: theme.navy }}>
        <Icon name={badge ? badge.icon : 'trophy'} color={theme.navy} size={26} />
      </View>
      <Text style={{ flexShrink: 1, fontFamily: FONTS.display, fontSize: TYPE.subheading, color: theme.navy }}>
        {words}
      </Text>
    </Animated.View>
  </View>;
}
