// The home screen: a shelf of game banners. Swipe (or use the arrows, the dots,
// a tap on the next banner, or the keyboard's arrow keys) to change game; choose
// an option; press Play. Design: design/Home_Play_Screen_Concept.png, DESIGN.md "Play screen".
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, View, type LayoutRectangle,
  type ViewStyle } from 'react-native';
import { GameBanner, type BannerStat } from '../components/GameBanner';
import { Icon } from '../components/Icon';
import { PageDots } from '../components/PageDots';
import { Tappable } from '../components/Tappable';
import { ANIMATIONS, USE_NATIVE_DRIVER, useAnimation } from '../design/motion';
import { RADIUS, SIZE } from '../design/tokens';
import type { ShelfGame, ShelfGameId } from '../games';
import type { Theme } from '../theme';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function PlayScreen({ theme, games, stats, choices, onChoose, onPlay, index, onIndex, toyConnected }: {
  readonly theme: Theme; readonly games: readonly ShelfGame[];
  readonly stats: Readonly<Record<ShelfGameId, BannerStat>>;
  readonly choices: Readonly<Partial<Record<ShelfGameId, string>>>;
  readonly onChoose: (game: ShelfGameId, value: string) => void; readonly onPlay: (game: ShelfGameId) => void;
  readonly index: number; readonly onIndex: (index: number) => void; readonly toyConnected: boolean;
}) {
  const [box, setBox] = useState<LayoutRectangle | null>(null);
  const count = games.length;
  const slide = useAnimation('shelfSlide');
  const neighbors = useAnimation('shelfNeighbors');
  const enter = useAnimation('screenEnter');

  // Banner size: as big as fits, keeping the design's wide proportions on tablets.
  const width = box?.width ?? 0;
  const height = box?.height ?? 0;
  const tall = width < 640 || width / Math.max(height, 1) < 1.1;
  const cardW = tall ? width - 56 : Math.min(SIZE.bannerMaxWidth, width * 0.74);
  const cardH = tall ? Math.min(height - 8, Math.max(600, cardW * 1.05)) : Math.min(height - 8, cardW / 1.62);
  const shrink = neighbors ? ANIMATIONS.shelfNeighbors.scale : 1;
  const gap = tall ? 12 : 36;
  const step = cardW / 2 + (cardW * shrink) / 2 + gap;

  const position = useRef(new Animated.Value(index)).current;
  const live = useRef({ index, step, count, onIndex });
  live.current = { index, step, count, onIndex };

  // ANIMATION(shelfSlide): glides the shelf to the chosen game.
  const settle = (target: number) => {
    if (!slide) { position.setValue(target); return; }
    Animated.timing(position, { toValue: target, duration: ANIMATIONS.shelfSlide.ms, easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER }).start();
  };
  useEffect(() => settle(index), [index, slide]);

  const go = (next: number) => onIndex(clamp(next, 0, count - 1));

  const pan = useMemo(() => PanResponder.create({
    // Only clearly sideways drags move the shelf, so taps and vertical scrolls still work.
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      const { index: at, step: size, count: total } = live.current;
      position.setValue(clamp(at - g.dx / size, -0.25, total - 0.75));
    },
    onPanResponderRelease: (_, g) => {
      const { index: at, step: size, count: total, onIndex: choose } = live.current;
      const far = Math.abs(g.dx) > size * 0.18 || Math.abs(g.vx) > 0.35;
      const next = far ? clamp(at + (g.dx < 0 ? 1 : -1), 0, total - 1) : at;
      if (next === at) settle(at); else choose(next);
    },
    onPanResponderTerminate: () => settle(live.current.index),
  }), []);

  // Keyboard: left and right arrows change game (web and hardware keyboards on tablets).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(live.current.index + 1);
      if (event.key === 'ArrowLeft') go(live.current.index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ANIMATION(screenEnter): the shelf fades up when the play screen opens.
  const appear = useRef(new Animated.Value(enter ? 0 : 1)).current;
  useEffect(() => {
    if (!enter || !box) return;
    Animated.timing(appear, { toValue: 1, duration: ANIMATIONS.screenEnter.ms, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [enter, box !== null]);

  const arrow = (direction: -1 | 1) => {
    const disabled = direction < 0 ? index === 0 : index === count - 1;
    return <Tappable accessibilityLabel={direction < 0 ? 'Previous game' : 'Next game'} disabled={disabled}
      onPress={() => go(index + direction)} focusColor={theme.focus}
      style={[styles.arrow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Icon name={direction < 0 ? 'chevronLeft' : 'chevronRight'} color={theme.text} size={26} weight={3} />
    </Tappable>;
  };

  return <View style={styles.screen}>
    <View style={styles.stage} onLayout={event => setBox(event.nativeEvent.layout)} {...pan.panHandlers}>
      {box && cardW > 0 && cardH > 0 && <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear,
        transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [ANIMATIONS.screenEnter.risePx, 0] }) }] }]}>
        {games.map((game, i) => {
          const distance = Math.abs(i - index);
          if (distance > 2) return null;
          const current = i === index;
          // ANIMATION(shelfNeighbors): banners beside the current one shrink and fade (under a wash of
          // the page color, so the bubbles never show through a banner) as they move away.
          const wash = neighbors ? position.interpolate({ inputRange: [i - 1, i, i + 1],
            outputRange: [1 - ANIMATIONS.shelfNeighbors.opacity, 0, 1 - ANIMATIONS.shelfNeighbors.opacity],
            extrapolate: 'clamp' }) : 0;
          const style = {
            left: (width - cardW) / 2, top: (height - cardH) / 2, zIndex: current ? 2 : 1,
            transform: [
              { translateX: position.interpolate({ inputRange: [i - 1, i + 1], outputRange: [step, -step] }) },
              { scale: position.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [shrink, 1, shrink],
                extrapolate: 'clamp' }) },
            ],
          };
          return <Animated.View key={game.id} style={[styles.card, style]}
            importantForAccessibility={current ? 'auto' : 'no-hide-descendants'} aria-hidden={!current}>
            <View pointerEvents={current ? 'auto' : 'none'}>
              <GameBanner theme={theme} game={game} stat={stats[game.id]} option={choices[game.id] ?? null}
                onOption={value => onChoose(game.id, value)} onPlay={() => onPlay(game.id)} width={cardW}
                height={cardH} active={current} toyConnected={toyConnected} />
            </View>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wash,
              { backgroundColor: theme.page, opacity: wash }]} />
            {!current && <Pressable accessible={false} onPress={() => go(i)} style={StyleSheet.absoluteFill} />}
          </Animated.View>;
        })}
      </Animated.View>}
      {box && !tall && <>
        <View style={[styles.arrowSlot, { left: Math.max(8, (width - cardW) / 2 - gap / 2 - 28), top: height / 2 - 28 }]}>
          {arrow(-1)}</View>
        <View style={[styles.arrowSlot, { right: Math.max(8, (width - cardW) / 2 - gap / 2 - 28), top: height / 2 - 28 }]}>
          {arrow(1)}</View>
      </>}
    </View>
    <View style={styles.footer}>
      {tall && arrow(-1)}
      <PageDots theme={theme} count={count} index={index} labels={games.map(game => game.title)} onSelect={go} />
      {tall && arrow(1)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  // 'clip' on web: unlike 'hidden', the browser can never scroll it sideways to show a focused control.
  screen: { flex: 1, ...(Platform.OS === 'web' ? ({ overflow: 'clip' } as unknown as ViewStyle) : { overflow: 'hidden' }) },
  // userSelect: dragging the shelf with a mouse must not select banner text (web).
  stage: { flex: 1, marginTop: 20, userSelect: 'none' },
  card: { position: 'absolute' },
  wash: { borderRadius: RADIUS.xl },
  arrowSlot: { position: 'absolute', zIndex: 3 },
  arrow: { width: SIZE.touchTarget, height: SIZE.touchTarget, borderRadius: SIZE.touchTarget / 2, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 18 },
});
