import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { type Celebration, useCelebration } from '@jimmyit/app-kit';
import type { Theme } from '../theme';
import { ANIMATIONS, USE_NATIVE_DRIVER, useAnimation } from '../design/motion';
import { FONTS, RADIUS, SPACE, TYPE } from '../design/tokens';

const SPARKLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function chipWords(celebration: Celebration): string {
  return celebration.kind === 'milestone' ? `${celebration.event.value} points!` : 'New best!';
}

/**
 * The running score at the top of a game. Score moments (every 100 points, a new best) celebrate here, in place,
 * so play is never interrupted: the number pops, sparks fly off it, and a chip says what happened.
 */
export function GameScoreBar({ theme, score, label = 'Score' }: {
  readonly theme: Theme; readonly score: number; readonly label?: string;
}) {
  const live = useCelebration();
  // The toy's own games celebrate in CelebrationToast; game ends in the app get the points dialog.
  const celebration = live && live.event.source === 'app' && live.kind !== 'bestAtEnd' ? live : null;
  const canPop = useAnimation('scorePop');
  const canSpark = useAnimation('scoreSparks');
  const pop = useRef(new Animated.Value(1)).current;
  const spark = useRef(new Animated.Value(0)).current;
  const chip = useRef(new Animated.Value(0)).current;
  const big = celebration?.kind === 'newBest';

  // ANIMATION(scorePop) and ANIMATION(scoreSparks): once per moment, then still.
  useEffect(() => {
    if (!celebration) {
      chip.setValue(0);
      return;
    }
    const { friction, tension, scale } = ANIMATIONS.scorePop;
    pop.setValue(canPop ? (big ? scale + 0.12 : scale) : 1);
    spark.setValue(0);
    chip.setValue(canPop ? 0 : 1);
    Animated.parallel([
      ...(canPop ? [
        Animated.spring(pop, { toValue: 1, friction, tension, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(chip, { toValue: 1, friction, tension, useNativeDriver: USE_NATIVE_DRIVER }),
      ] : []),
      ...(canSpark ? [Animated.timing(spark, { toValue: 1, duration: ANIMATIONS.scoreSparks.ms,
        easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER })] : []),
    ]).start();
  }, [celebration, big, canPop, canSpark, pop, spark, chip]);

  const accent = big ? theme.gold : theme.accentText;
  const sparkColors = [theme.yellow, theme.coral, theme.mint, theme.purple];
  return <View accessibilityRole="summary" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: SPACE.md, alignSelf: 'stretch', minHeight: 64, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm,
    marginBottom: SPACE.lg, borderRadius: RADIUS.lg, backgroundColor: theme.surface,
    borderWidth: 2, borderColor: celebration ? accent : theme.border }}>
    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, letterSpacing: 2, color: theme.secondary }}>
      {label.toUpperCase()}
    </Text>
    <View>
      {canSpark && celebration && SPARKLE_ANGLES.map((angle, i) => {
        const radians = angle * Math.PI / 180;
        const reach = (big ? 46 : 34) + (i % 2) * 10;
        return <Animated.View key={angle} pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%',
          width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: i % 2 ? 4 : 1,
          backgroundColor: sparkColors[i % sparkColors.length], opacity: spark.interpolate({
            inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
          transform: [
            { translateX: spark.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(radians) * reach] }) },
            { translateY: spark.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(radians) * reach] }) },
            { rotate: spark.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 ? 180 : -180}deg`] }) },
          ] }} />;
      })}
      <Animated.Text accessibilityLiveRegion="polite" style={{ fontFamily: FONTS.display, fontSize: TYPE.heading,
        lineHeight: TYPE.heading * 1.2, color: theme.text, transform: [{ scale: pop }] }}>{score}</Animated.Text>
    </View>
    {celebration && <Animated.View accessibilityLiveRegion="polite" style={{ marginLeft: 'auto',
      paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xs + 2, borderRadius: RADIUS.pill,
      backgroundColor: big ? theme.yellow : theme.softMint, opacity: chip,
      transform: [{ scale: chip.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: TYPE.subheading, color: big ? theme.navy : theme.text }}>
        {big ? '★ ' : ''}{chipWords(celebration)}
      </Text>
    </Animated.View>}
  </View>;
}
