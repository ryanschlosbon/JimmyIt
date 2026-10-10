import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, Text, View } from 'react-native';
import { type Celebration, useCelebration } from '@jimmyit/app-kit';
import { Jimmy } from './Jimmy';
import type { Theme } from '../theme';

const CONFETTI = ['#FFD844', '#70D2B5', '#EF756D', '#8E6BCD', '#F1DCEB', '#15A99A'];

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
  const [reduceMotion, setReduceMotion] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    fall.setValue(0);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(fall, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [visible, reduceMotion, pop, fall]);

  if (!visible || visible === dismissed) return null;
  const { title, detail } = words(visible);
  const big = visible.kind !== 'milestone';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title} ${detail} Tap to close.`}
    onPress={() => setDismissed(visible)}
    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center',
      backgroundColor: '#0F1D3366' }}>
    {!reduceMotion && CONFETTI.flatMap((color, i) => [0, 1, 2].map(row => <Animated.View key={`${i}-${row}`}
      style={{ position: 'absolute', top: -20, left: `${8 + i * 15 + row * 5}%`, width: 12, height: 12,
        borderRadius: row === 1 ? 6 : 2, backgroundColor: color,
        transform: [
          { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, 420 + row * 120 + i * 20] }) },
          { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 540}deg`] }) },
        ] }} />))}
    <Animated.View accessibilityLiveRegion="assertive" style={{ transform: [{ scale: pop }], width: '86%', maxWidth: 440,
      backgroundColor: big ? theme.yellow : theme.surface, borderRadius: 32, padding: 28, alignItems: 'center', gap: 14,
      borderWidth: 3, borderColor: big ? '#203858' : theme.mint }}>
      <Jimmy face size={big ? 96 : 76} color={theme.mint} />
      <Text style={{ fontFamily: 'Baloo', fontSize: big ? 40 : 34, color: '#203858', textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontFamily: 'Poppins', fontSize: 20, color: big ? '#203858' : theme.text, textAlign: 'center' }}>{detail}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2].map(i => <Text key={i} style={{ fontSize: 26 }}>⭐</Text>)}
      </View>
    </Animated.View>
  </Pressable>;
}
