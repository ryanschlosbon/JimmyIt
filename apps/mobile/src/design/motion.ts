// Every animation in the app is listed here, by name. To turn one off, set its
// `enabled` to false; to change one, edit its numbers. In the code, each place
// that animates is marked with a comment `ANIMATION(<name>)`, so
// `grep -rn "ANIMATION(" src` finds them all. DESIGN.md explains the rules.
//
// All animations also stop when the device asks for reduced motion
// (useReducedMotion below), except the press depression, which is a tiny,
// direct response to the child's own touch.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export const ANIMATIONS = {
  /** Buttons sink and darken slightly while pressed. */
  pressDepress: { enabled: true, scale: 0.95, sinkPx: 3, inMs: 70, outMs: 160 },
  /** Game banners slide when swiping or choosing another game. */
  shelfSlide: { enabled: true, ms: 340 },
  /** Banners beside the current one are smaller and dimmer. */
  shelfNeighbors: { enabled: true, scale: 0.86, opacity: 0.55 },
  /** The current page dot stretches into a pill. */
  dotStretch: { enabled: true, activeWidth: 34, ms: 220 },
  /** A chosen option chip pops. */
  chipPop: { enabled: true, scale: 1.08, ms: 120 },
  /** The "how to play" tip fades and grows in. */
  tipReveal: { enabled: true, ms: 160 },
  /** Background bubbles float upward, sway, and are replaced by new random ones forever. */
  bubblesFloat: {
    enabled: true,
    count: 7,
    /** Diameter range, as a fraction of the window's longer side. */
    minSize: 0.14,
    maxSize: 0.32,
    /** Rise speed range, in pixels per second. Slow on purpose: calm, not distracting. */
    minSpeed: 14,
    maxSpeed: 28,
    /** Side-to-side sway, in pixels, and how long one sway takes. */
    swayPx: 26,
    swayMs: 9_000,
  },
  /** The play screen's banners fade up when the screen opens. */
  screenEnter: { enabled: true, ms: 280, risePx: 14 },
  /**
   * Opening screen (screens/IntroScreen.tsx): a coral iris closes in on Jimmy's face, he hops and lands
   * with a little rebound, then rolls off to the right, pulling the screen away in stripes.
   */
  introReveal: {
    enabled: true,
    delayMs: 350,
    /** The coral iris closing from beyond the screen's corners to Jimmy's face. */
    irisMs: 1000,
    /** A pause on the finished picture before the hop. */
    settleMs: 250,
    /** Hop height as a fraction of Jimmy's radius (capped so he stays on screen). */
    hopHeight: 1.2,
    hopUpMs: 320,
    hopDownMs: 280,
    /** The small bounce after landing, as a fraction of the hop height. */
    reboundHeight: 0.2,
    /** A pause after landing before he rolls. */
    holdMs: 220,
    /** Rolling off to the right while the screen peels away in stripes. */
    rollMs: 1500,
  },
  /** Big score moments: the card springs in (components/CelebrationOverlay.tsx). */
  celebrationPop: { enabled: true, friction: 5, tension: 120 },
  /** Big score moments: confetti falls and spins (components/CelebrationOverlay.tsx). */
  celebrationConfetti: { enabled: true, ms: 2400 },
} as const;

export type AnimationName = keyof typeof ANIMATIONS;

/** React Native's native driver is not available on web. */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** True when the device asks for less motion. Animations other than pressDepress should then not run. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

/** Whether a named animation should run right now. */
export function useAnimation(name: AnimationName): boolean {
  const reduced = useReducedMotion();
  return ANIMATIONS[name].enabled && (name === 'pressDepress' || !reduced);
}
