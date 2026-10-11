// "Game 2 of 4" dots under the play shelf. Each dot is also a button to that game.
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ANIMATIONS, useAnimation } from '../design/motion';
import type { Theme } from '../theme';
import { Tappable } from './Tappable';

// A white ring keeps each dot visible when a bubble of the same color floats behind it.
const DOT = 20;
const RING = 3;

function Dot({ theme, active, label, onPress }: {
  readonly theme: Theme; readonly active: boolean; readonly label: string; readonly onPress: () => void;
}) {
  const canStretch = useAnimation('dotStretch');
  const stretch = useRef(new Animated.Value(active ? 1 : 0)).current;
  // ANIMATION(dotStretch): the current dot grows into a pill (layout animation, so no native driver).
  useEffect(() => {
    if (!canStretch) { stretch.setValue(active ? 1 : 0); return; }
    Animated.timing(stretch, { toValue: active ? 1 : 0, duration: ANIMATIONS.dotStretch.ms, useNativeDriver: false }).start();
  }, [active, canStretch, stretch]);
  return <Tappable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }}
    onPress={onPress} focusColor={theme.focus} hitSlop={{ top: 14, bottom: 14 }} style={styles.hit}>
    <Animated.View style={{ height: DOT, borderRadius: DOT / 2,
      width: stretch.interpolate({ inputRange: [0, 1], outputRange: [DOT, ANIMATIONS.dotStretch.activeWidth + RING * 2] }),
      backgroundColor: active ? theme.dotActive : theme.dot, borderWidth: RING, borderColor: theme.surface }} />
  </Tappable>;
}

export function PageDots({ theme, count, index, labels, onSelect }: {
  readonly theme: Theme; readonly count: number; readonly index: number; readonly labels: readonly string[];
  readonly onSelect: (index: number) => void;
}) {
  return <View accessibilityRole="tablist" style={styles.row}>
    {Array.from({ length: count }, (_, i) => <Dot key={i} theme={theme} active={i === index}
      label={`${labels[i] ?? `Game ${i + 1}`}, game ${i + 1} of ${count}`} onPress={() => onSelect(i)} />)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  hit: { minWidth: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
