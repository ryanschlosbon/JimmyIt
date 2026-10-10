import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { type Celebration, useCelebration } from '@jimmyit/app-kit';
import { Jimmy } from './Jimmy';
import type { Theme } from '../theme';
import { ANIMATIONS, USE_NATIVE_DRIVER, useAnimation } from '../design/motion';
import { FONTS } from '../design/tokens';

function words(celebration: Celebration): { title: string; detail: string } {
  const { event } = celebration;
  const where = event.source === 'toy' ? ' on Jimmy' : '';
  switch (celebration.kind) {
    case 'newBest':
      return { title: 'New high score!', detail: `${event.score} points${where}. You beat ${event.value}!` };
    case 'milestone':
      return { title: `${event.value} points!`, detail: `Amazing job${where}. Keep going!` };
    case 'bestAtEnd':
      return { title: 'Your best ever!', detail: `${event.score} points${where}.` };
  }
}

/**
 * A short, skippable celebration for big score moments (every 100 points, a new
 * high score), whether the game runs in the app or on the toy. Driven entirely
 * by app-kit's useCelebration(); the look here is a placeholder for the redesign.
 */
export function CelebrationOverlay({ theme }: { readonly theme: Theme }) {
  const celebration = useCelebration();
  // Game ends in the app already show the points dialog; only the toy's own game ends get this.
  const visible = celebration && !(celebration.kind === 'bestAtEnd' && celebration.event.source === 'app') ? celebration : null;
  const [dismissed, setDismissed] = useState<Celebration | null>(null);
  const canPop = useAnimation('celebrationPop');
  const confetti = useAnimation('celebrationConfetti');
  const pop = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const colors = [theme.yellow, theme.mint, theme.coral, theme.purple, theme.pink, theme.teal];

  // ANIMATION(celebrationPop) and ANIMATION(celebrationConfetti).
  useEffect(() => {
    if (!visible) return;
    pop.setValue(canPop ? 0 : 1);
    fall.setValue(0);
    const { friction, tension } = ANIMATIONS.celebrationPop;
    Animated.parallel([
      ...(canPop ? [Animated.spring(pop, { toValue: 1, friction, tension, useNativeDriver: USE_NATIVE_DRIVER })] : []),
      ...(confetti ? [Animated.timing(fall, { toValue: 1, duration: ANIMATIONS.celebrationConfetti.ms,
        easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER })] : []),
    ]).start();
  }, [visible, canPop, confetti, pop, fall]);

  if (!visible || visible === dismissed) return null;
  const { title, detail } = words(visible);
  const big = visible.kind !== 'milestone';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title} ${detail} Tap to close.`}
    onPress={() => setDismissed(visible)}
    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center',
      backgroundColor: theme.scrim }}>
    {confetti && colors.flatMap((color, i) => [0, 1, 2].map(row => <Animated.View key={`${i}-${row}`}
      style={{ position: 'absolute', top: -20, left: `${8 + i * 15 + row * 5}%`, width: 12, height: 12,
        borderRadius: row === 1 ? 6 : 2, backgroundColor: color,
        transform: [
          { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, 420 + row * 120 + i * 20] }) },
          { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 540}deg`] }) },
        ] }} />))}
    <Animated.View accessibilityLiveRegion="assertive" style={{ transform: [{ scale: pop }], width: '86%', maxWidth: 440,
      backgroundColor: big ? theme.yellow : theme.surface, borderRadius: 32, padding: 28, alignItems: 'center', gap: 14,
      borderWidth: 3, borderColor: big ? theme.navy : theme.mint }}>
      <Jimmy face size={big ? 96 : 76} color={theme.mint} />
      <Text style={{ fontFamily: FONTS.display, fontSize: big ? 40 : 34, color: theme.navy, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 20, color: big ? theme.navy : theme.text, textAlign: 'center' }}>{detail}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2].map(i => <Text key={i} style={{ fontSize: 26 }}>⭐</Text>)}
      </View>
    </Animated.View>
  </Pressable>;
}
