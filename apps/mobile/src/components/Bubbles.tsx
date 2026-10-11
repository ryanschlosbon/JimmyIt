// The colored circles behind every screen (design/Bubbles_Background.png).
// `animated` on: ANIMATION(bubblesFloat) — an endless stream of random bubbles
// that rise slowly and sway; each one that leaves the top is replaced by a new
// random bubble at the bottom. Off (Settings → Floating bubbles, or reduced
// motion): the still layout from the design file.
import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ANIMATIONS, USE_NATIVE_DRIVER, useAnimation } from '../design/motion';
import type { Theme } from '../theme';

/** The still layout, as fractions of the window: x and y of the center, diameter of the longer side. */
const STILL_BUBBLES: readonly { x: number; y: number; size: number; color: number }[] = [
  { x: 0.15, y: 0.19, size: 0.27, color: 0 },
  { x: 0.37, y: -0.03, size: 0.18, color: 1 },
  { x: 0.95, y: 0.09, size: 0.3, color: 2 },
  { x: 0.09, y: 0.88, size: 0.3, color: 1 },
  { x: 1.0, y: 1.0, size: 0.27, color: 0 },
];

interface BubbleSpec {
  readonly id: number;
  readonly size: number;
  readonly x: number;
  readonly color: string;
  readonly speed: number;
  readonly startY: number;
  readonly swayMs: number;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/** Most bubbles keep to the sides so they frame the content instead of hiding behind it. */
function randomX(width: number): number {
  const side = Math.random();
  if (side < 0.4) return random(-0.12, 0.28) * width;
  if (side < 0.8) return random(0.72, 1.12) * width;
  return random(0.28, 0.72) * width;
}

let nextBubbleId = 0;
/** `turn` walks each bubble through the colors so the screen always has an even mix. */
function randomBubble(width: number, height: number, colors: readonly string[], turn: number,
  initial = false): BubbleSpec {
  const settings = ANIMATIONS.bubblesFloat;
  const longSide = Math.max(width, height);
  const size = random(settings.minSize, settings.maxSize) * longSide;
  return {
    id: nextBubbleId++,
    size,
    x: randomX(width),
    color: colors[turn % Math.max(colors.length, 1)] ?? '',
    speed: random(settings.minSpeed, settings.maxSpeed),
    startY: initial ? random(-size / 2, height + size / 2) : height + size / 2,
    swayMs: random(settings.swayMs * 0.8, settings.swayMs * 1.2),
  };
}

function FloatingBubble({ index, width, height, colors, opacity }: {
  readonly index: number; readonly width: number; readonly height: number;
  readonly colors: readonly string[]; readonly opacity: number;
}) {
  const turn = useRef(index);
  const [spec, setSpec] = useState(() => randomBubble(width, height, colors, turn.current, true));
  const replace = () => {
    turn.current += 1;
    setSpec(randomBubble(width, height, colors, turn.current));
  };

  // A replacement gets its own values below the screen in the same render as its new size/color.
  return <BubbleMotion key={spec.id} spec={spec} index={index} opacity={opacity} onExit={replace} />;
}

function BubbleMotion({ spec, index, opacity, onExit }: {
  readonly spec: BubbleSpec; readonly index: number; readonly opacity: number; readonly onExit: () => void;
}) {
  const settings = ANIMATIONS.bubblesFloat;
  const rise = useRef(new Animated.Value(spec.startY)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const exit = useRef(onExit);
  exit.current = onExit;

  useEffect(() => {
    const end = -spec.size / 2;
    let active = true;
    const animation = Animated.timing(rise, { toValue: end,
      duration: ((spec.startY - end) / spec.speed) * 1000,
      easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false });
    animation.start(({ finished }) => {
      if (active && finished) exit.current();
    });
    return () => { active = false; animation.stop(); };
  }, [spec, rise]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: spec.swayMs / 2, easing: Easing.inOut(Easing.sin),
        useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false }),
      Animated.timing(sway, { toValue: 0, duration: spec.swayMs / 2, easing: Easing.inOut(Easing.sin),
        useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [sway, spec.swayMs]);

  const swayPx = settings.swayPx * (index % 2 === 0 ? 1 : -1);
  return <Animated.View style={[styles.bubble, {
    width: spec.size, height: spec.size, borderRadius: spec.size / 2, backgroundColor: spec.color, opacity,
    left: spec.x - spec.size / 2, top: -spec.size / 2,
    transform: [{ translateY: rise }, { translateX: sway.interpolate({ inputRange: [0, 1], outputRange: [-swayPx, swayPx] }) }],
  }]} />;
}

export const Bubbles = memo(function Bubbles({ theme, animated }: { readonly theme: Theme; readonly animated: boolean }) {
  const { width, height } = useWindowDimensions();
  const canAnimate = useAnimation('bubblesFloat');
  const longSide = Math.max(width, height);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
    {animated && canAnimate
      ? Array.from({ length: ANIMATIONS.bubblesFloat.count }, (_, index) => <FloatingBubble key={`${index}-${width}x${height}-${theme.bubbles.join()}`}
        index={index} width={width} height={height} colors={theme.bubbles} opacity={theme.bubbleOpacity} />)
      : STILL_BUBBLES.map((bubble, index) => {
        const size = bubble.size * longSide;
        return <View key={index} style={[styles.bubble, { width: size, height: size, borderRadius: size / 2,
          left: bubble.x * width - size / 2, top: bubble.y * height - size / 2, opacity: theme.bubbleOpacity,
          backgroundColor: theme.bubbles[bubble.color % theme.bubbles.length] }]} />;
      })}
  </View>;
});

const styles = StyleSheet.create({
  layer: { overflow: 'hidden' },
  bubble: { position: 'absolute' },
});
