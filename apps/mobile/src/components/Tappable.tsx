// The one pressable surface every button in the app is built on. It gives each
// press the same feel: the button sinks and darkens a little (ANIMATION(pressDepress)),
// clicks (design/sounds.ts), shows a highlight on hover (web), and draws a focus ring
// for keyboard users.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type AccessibilityRole,
  type AccessibilityState, type Insets, type StyleProp, type ViewStyle } from 'react-native';
import { ANIMATIONS, USE_NATIVE_DRIVER } from '../design/motion';
import type { SoundName } from '../design/sounds';
import { appSounds } from '../sound-cues';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Show focus rings only after keyboard use, like CSS :focus-visible.
let keyboardModality = false;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { keyboardModality = true; }, true);
  window.addEventListener('pointerdown', () => { keyboardModality = false; }, true);
}

export interface TappableProps {
  readonly onPress: () => void;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly accessibilityRole?: AccessibilityRole;
  readonly accessibilityState?: AccessibilityState;
  readonly focusColor?: string;
  readonly hitSlop?: Insets;
  /** How much the press darkens the surface, 0-1. Lighter surfaces look best with the default. */
  readonly pressShade?: number;
  readonly testID?: string;
  /** False takes the button out of keyboard focus (e.g. on a banner that is off to the side). */
  readonly focusable?: boolean;
  /** The sound a press makes; null for none. Default 'click'. */
  readonly sound?: SoundName | null;
}

export function Tappable({ onPress, children, style, disabled = false, accessibilityLabel, accessibilityHint,
  accessibilityRole = 'button', accessibilityState, focusColor = '#9A6E00', hitSlop, pressShade = 0.1,
  testID, focusable = true, sound = 'click' }: TappableProps) {
  const press = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const motion = ANIMATIONS.pressDepress;
  const radius = StyleSheet.flatten(style)?.borderRadius ?? 0;

  // ANIMATION(pressDepress): sink on press in, spring back on release.
  const animateTo = (value: 0 | 1) => {
    if (!motion.enabled) { press.setValue(value); return; }
    Animated.timing(press, { toValue: value, duration: value ? motion.inMs : motion.outMs,
      useNativeDriver: USE_NATIVE_DRIVER }).start();
  };
  useEffect(() => { if (disabled) press.setValue(0); }, [disabled, press]);
  const handlePress = () => {
    if (sound) appSounds.play(sound);
    onPress();
  };

  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, motion.scale] });
  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, motion.sinkPx] });

  return <AnimatedPressable testID={testID} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint} accessibilityState={{ disabled, ...accessibilityState }} disabled={disabled}
    // react-native-web reads the aria-* forms of the state; native reads accessibilityState.
    aria-disabled={disabled} aria-selected={accessibilityState?.selected} aria-checked={accessibilityState?.checked}
    aria-expanded={accessibilityState?.expanded}
    hitSlop={hitSlop} focusable={focusable && !disabled} onPress={handlePress} onPressIn={() => animateTo(1)} onPressOut={() => animateTo(0)}
    onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
    onFocus={() => setFocused(keyboardModality || Platform.OS !== 'web')} onBlur={() => setFocused(false)}
    style={[style, { transform: [{ translateY }, { scale }] }, disabled && styles.disabled]}>
    {children}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius,
      backgroundColor: '#000000', opacity: Animated.add(press.interpolate({ inputRange: [0, 1],
        outputRange: [0, pressShade] }), hovered && !disabled ? pressShade * 0.4 : 0) }]} />
    {focused && <View pointerEvents="none" style={[styles.focusRing, { borderColor: focusColor,
      borderRadius: Number(radius) + 5 }]} />}
  </AnimatedPressable>;
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  focusRing: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderWidth: 3 },
});
