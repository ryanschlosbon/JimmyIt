import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View, useWindowDimensions,
  type EasingFunction } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_ARTWORK, INTRO_BACKGROUNDS, INTRO_LAYOUT } from '../artwork';
import { ANIMATIONS, USE_NATIVE_DRIVER } from '../design/motion';

// The coral screen peels away in pill-shaped stripes. Each list repeats per stripe: relative thickness,
// a little extra delay so neighbors don't move together, and how long after Jimmy leaves it finishes
// (as a fraction of his roll), which gives the stripes their different lengths.
const STRIPE_THICKNESS = [1, 1.3, 0.8, 1.15, 0.9, 1.25, 0.85, 1.1, 0.95, 1.2] as const;
const STRIPE_JITTER = [0.1, 0, 0.16, 0.05, 0.12, 0.02, 0.14, 0.07, 0.11, 0.03] as const;
const STRIPE_FINISH = [0.05, 0.22, 0.12, 0.3, 0.08, 0.26, 0.16, 0.02, 0.2, 0.1] as const;
/** About how thick a stripe is, in pixels. */
const STRIPE_PX = 110;

interface Stripe {
  readonly top: number;
  readonly height: number;
  /** When the stripe starts and finishes moving, as fractions of the roll. */
  readonly start: number;
  readonly end: number;
}

/** Lays the 1280 × 800 composition over the window the way contain sizing would, plus the stripes. */
function introGeometry(width: number, height: number) {
  const { face, wordmark } = INTRO_LAYOUT;
  const scale = Math.min(Math.min(width, INTRO_LAYOUT.width) / INTRO_LAYOUT.width, height / INTRO_LAYOUT.height);
  const left = (width - INTRO_LAYOUT.width * scale) / 2;
  const top = (height - INTRO_LAYOUT.height * scale) / 2;
  const cx = left + face.centerX * scale;
  const cy = top + face.centerY * scale;
  const radius = face.radius * scale;
  const farthest = Math.max(Math.hypot(cx, cy), Math.hypot(width - cx, cy), Math.hypot(cx, height - cy),
    Math.hypot(width - cx, height - cy));
  // Rolling this far takes Jimmy fully off the right edge; the stripes finish a little later.
  const exitPx = width - cx + radius;
  const count = Math.max(5, Math.min(STRIPE_THICKNESS.length, Math.round(height / STRIPE_PX)));
  const weights = Array.from({ length: count }, (_, i) => STRIPE_THICKNESS[i] ?? 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const finishes = weights.map((_, i) => STRIPE_FINISH[i] ?? 0);
  const rollFraction = 1 + Math.max(...finishes);
  let edge = 0;
  const stripes: Stripe[] = weights.map((weight, i) => {
    const stripeTop = Math.round(edge);
    edge += (weight / total) * height;
    const stripeHeight = Math.round(edge) - stripeTop;
    // Stripes level with Jimmy go first; ones farther up and down trail behind.
    const distance = Math.min(1, Math.abs(stripeTop + stripeHeight / 2 - cy) / Math.max(height, 1));
    const lag = 0.04 + 0.32 * distance + (STRIPE_JITTER[i] ?? 0);
    return { top: stripeTop, height: stripeHeight, start: lag / rollFraction, end: (1 + (finishes[i] ?? 0)) / rollFraction };
  });
  return {
    cx, cy, radius,
    faceSize: face.imageSize * scale,
    wordmark: { left: left + wordmark.x * scale, top: top + wordmark.y * scale,
      width: wordmark.width * scale, height: wordmark.height * scale },
    // A coral ring this thick still covers the corners once it has closed down to Jimmy's face.
    ringPx: farthest + 8,
    // How much bigger the ring starts, so its hole begins beyond every corner of the screen.
    irisStart: (farthest + 8) / Math.max(radius, 1),
    rollPx: exitPx * rollFraction,
    hopPx: Math.max(0, Math.min(radius * ANIMATIONS.introReveal.hopHeight, cy - radius - 16)),
    stripes,
  };
}

export function IntroScreen({ ready, onDone }: { readonly ready: boolean; readonly onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const geometry = useMemo(() => introGeometry(width, height), [width, height]);
  // 0 → 1: the iris closes on the face. Then `stage` swaps the mint scene for the coral stripes.
  const iris = useRef(new Animated.Value(0)).current;
  const stage = useRef(new Animated.Value(0)).current;
  // Jimmy: `hop` 1 = top of the hop, `squash` 1 = round, `roll` 1 = rolled off with every stripe gone.
  const hop = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(1)).current;
  const roll = useRef(new Animated.Value(0)).current;
  const chrome = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState({ face: false, wordmark: false });

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); })
      .catch(() => { if (active) setReduceMotion(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!ready || reduceMotion === null || !loaded.face || !loaded.wordmark) return;
    // ANIMATION(introReveal): a still coral picture for reduced motion or when the animation is turned off.
    const still = reduceMotion || !ANIMATIONS.introReveal.enabled;
    const { delayMs, irisMs, settleMs, hopUpMs, hopDownMs, reboundHeight, holdMs, rollMs } = ANIMATIONS.introReveal;
    iris.setValue(still ? 1 : 0);
    stage.setValue(still ? 1 : 0);
    hop.setValue(0);
    squash.setValue(1);
    roll.setValue(0);
    chrome.setValue(1);
    const to = (value: Animated.Value, toValue: number, duration: number, easing?: EasingFunction) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver: USE_NATIVE_DRIVER });
    const out = Easing.out(Easing.quad);
    const fall = Easing.in(Easing.quad);
    const animation = still ? Animated.delay(600) : Animated.sequence([
      Animated.delay(delayMs),
      to(iris, 1, irisMs, Easing.inOut(Easing.cubic)),
      // The ring's hole now matches Jimmy exactly, so swapping to solid coral behind him is invisible.
      to(stage, 1, 0),
      Animated.delay(settleMs),
      to(squash, 0.86, 140, out), // crouch
      Animated.parallel([ // spring up, stretched tall
        to(hop, 1, hopUpMs, out),
        Animated.sequence([to(squash, 1.12, 110, out), to(squash, 1, hopUpMs - 110)]),
      ]),
      Animated.parallel([ // fall, stretching as he speeds up
        to(hop, 0, hopDownMs, fall),
        Animated.sequence([Animated.delay(hopDownMs / 2), to(squash, 1.1, hopDownMs / 2)]),
      ]),
      to(squash, 0.75, 80, out), // squish on landing
      Animated.parallel([ // a little rebound
        to(squash, 1.06, 150, out),
        Animated.sequence([to(hop, reboundHeight, 150, out), to(hop, 0, 140, fall)]),
      ]),
      to(squash, 0.9, 70, out),
      Animated.spring(squash, { toValue: 1, friction: 4, tension: 220, restSpeedThreshold: 0.05,
        restDisplacementThreshold: 0.005, useNativeDriver: USE_NATIVE_DRIVER }), // a jelly wobble
      Animated.delay(holdMs),
      to(roll, -0.03, 200, out), // lean back before rolling away
      Animated.parallel([to(chrome, 0, 200), to(roll, 1, rollMs, Easing.in(Easing.sin))]),
    ]);
    animation.start(({ finished }) => { if (finished) onDone(); });
    return () => animation.stop();
  }, [chrome, hop, iris, loaded.face, loaded.wordmark, onDone, ready, reduceMotion, roll, squash, stage]);

  const { cx, cy, radius, faceSize, wordmark, ringPx, stripes } = geometry;
  const coral = INTRO_BACKGROUNDS.end;
  const wordmarkStyle = { position: 'absolute', width: wordmark.width, height: wordmark.height } as const;
  return <View style={StyleSheet.absoluteFill}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: INTRO_BACKGROUNDS.start,
      opacity: stage.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cx - radius - ringPx,
        top: cy - radius - ringPx, width: 2 * (radius + ringPx), height: 2 * (radius + ringPx),
        borderRadius: radius + ringPx, borderWidth: ringPx, borderColor: coral,
        transform: [{ scale: iris.interpolate({ inputRange: [0, 1], outputRange: [geometry.irisStart, 1] }) }] }} />
      <Image source={APP_ARTWORK.introWordmark} resizeMode="stretch" accessibilityLabel="JimmyIt"
        onLoad={() => setLoaded(current => ({ ...current, wordmark: true }))}
        onError={() => setLoaded(current => ({ ...current, wordmark: true }))}
        style={[wordmarkStyle, { left: wordmark.left, top: wordmark.top }]} />
    </Animated.View>
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { opacity: stage }]}>
      {stripes.map(stripe => <Animated.View key={stripe.top} style={{ position: 'absolute', top: stripe.top,
        // Both rounded ends start off screen; the stripe slides right until its left end leaves too.
        left: -stripe.height, width: width + 2 * stripe.height, height: stripe.height + 1,
        borderRadius: stripe.height / 2, overflow: 'hidden', backgroundColor: coral,
        transform: [{ translateX: roll.interpolate({ inputRange: [stripe.start, stripe.end],
          outputRange: [0, width + stripe.height], extrapolate: 'clamp' }) }] }}>
        {stripe.top < wordmark.top + wordmark.height && stripe.top + stripe.height > wordmark.top
          && <Image source={APP_ARTWORK.introWordmark} resizeMode="stretch" accessible={false}
            style={[wordmarkStyle, { left: wordmark.left + stripe.height, top: wordmark.top - stripe.top }]} />}
      </Animated.View>)}
    </Animated.View>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cx - faceSize / 2, top: cy - faceSize / 2,
      width: faceSize, height: faceSize, transform: [
        { translateX: roll.interpolate({ inputRange: [0, 1], outputRange: [0, geometry.rollPx] }) },
        { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -geometry.hopPx] }) },
        // Squash and stretch from his bottom, so he stays on the ground.
        { translateY: squash.interpolate({ inputRange: [0, 2], outputRange: [radius, -radius] }) },
        { scaleX: squash.interpolate({ inputRange: [0.5, 1, 1.5], outputRange: [1.4, 1, 0.8] }) },
        { scaleY: squash },
        { rotate: roll.interpolate({ inputRange: [0, 1],
          outputRange: ['0deg', `${(geometry.rollPx / Math.max(radius, 1)) * (180 / Math.PI)}deg`] }) },
      ] }}>
      <Image source={APP_ARTWORK.introFace} resizeMode="stretch" accessibilityLabel="JimmyIt smiling character"
        onLoad={() => setLoaded(current => ({ ...current, face: true }))}
        onError={() => setLoaded(current => ({ ...current, face: true }))}
        style={{ width: '100%', height: '100%' }} />
    </Animated.View>
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: chrome }]}>
      <SafeAreaView pointerEvents="box-none"
        style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 28, gap: 18 }}>
        <Text style={{ fontSize: 24, fontWeight: '600', color: '#203858', textAlign: 'center' }}>Little moves. Big smiles.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={onDone}
          style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 25, paddingVertical: 15,
            borderRadius: 18, backgroundColor: '#FFFCF7', opacity: pressed ? .75 : 1 })}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#203858' }}>{ready ? 'Let’s play' : 'Skip intro'}</Text>
        </Pressable>
      </SafeAreaView>
    </Animated.View>
  </View>;
}
