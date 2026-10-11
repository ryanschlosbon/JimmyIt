import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProgress } from '@jimmyit/app-kit';
import { BADGE_VISUALS } from './badge-visuals';
import { getTheme } from './theme';
import { RewardsScreen } from './screens/RewardsScreen';
import { Bubbles } from './components/Bubbles';
import { ANIMATIONS } from './design/motion';

const harness = vi.hoisted(() => ({
  width: 375, height: 812, animate: true,
  effects: [] as (() => void | (() => void))[],
  timings: [] as { value: { initial: number }; toValue: number; isInteraction: boolean }[],
  loops: [] as { sequence: readonly { value: { initial: number }; toValue: number }[] }[],
  styles: [] as { height: number; top: number; transform: readonly { translateY?: { initial: number } }[] }[],
}));

// Expo supplies JSX's React binding; the Node renderer needs it explicitly.
vi.stubGlobal('React', React);
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
}));
vi.mock('react-native', () => {
  const View = ({ children, style, accessibilityLabel }: {
    children?: React.ReactNode; style?: React.CSSProperties; accessibilityLabel?: string;
  }) => React.createElement('div', {
    style: Array.isArray(style) ? undefined : style, 'aria-label': accessibilityLabel,
  }, children);
  return {
    View, Text: View, Image: () => null, Platform: { OS: 'web' },
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
    useWindowDimensions: () => ({ width: harness.width, height: harness.height }),
    Easing: { linear: 'linear', sin: 'sin', inOut: (curve: unknown) => curve },
    Animated: {
      Value: function (this: { initial: number; interpolate: () => null }, initial: number) {
        this.initial = initial;
        this.interpolate = () => null;
      },
      View: ({ style }: { style: [unknown, (typeof harness.styles)[number]] }) => {
        harness.styles.push(style[1]);
        return null;
      },
      timing: (value: { initial: number }, config: { toValue: number; isInteraction: boolean }) => {
        const timing = { value, ...config, start: vi.fn(), stop: vi.fn() };
        harness.timings.push(timing);
        return timing;
      },
      sequence: (sequence: unknown) => ({ sequence }),
      loop: (sequence: (typeof harness.loops)[number]) => {
        harness.loops.push(sequence);
        return { start: vi.fn(), stop: vi.fn() };
      },
    },
  };
});
vi.mock('./design/motion', async importOriginal => ({
  ...await importOriginal<typeof import('./design/motion')>(),
  useAnimation: () => harness.animate,
}));
vi.mock('./artwork', () => ({ APP_ARTWORK: {} }));
vi.mock('./components/Jimmy', () => ({ Jimmy: () => null }));
vi.mock('./components/Tappable', () => ({ Tappable: () => null }));
vi.mock('./components/Icon', () => ({
  Icon: ({ name, color }: { name: string; color: string }) =>
    React.createElement('span', { 'data-icon': name, style: { color } }),
}));

beforeEach(() => {
  harness.width = 375;
  harness.height = 812;
  harness.animate = true;
  harness.effects.length = 0;
  harness.timings.length = 0;
  harness.loops.length = 0;
  harness.styles.length = 0;
});

describe('badge presentation', () => {
  const progress = getProgress([]);
  const badges = progress.badges.map(badge => ({ ...badge, ...BADGE_VISUALS[badge.id] }));

  it.each(['classic', 'calm'] as const)('shows criteria and gray locked artwork in %s, light and dark', style => {
    for (const dark of [false, true]) {
      const theme = getTheme(dark, style);
      const html = renderToStaticMarkup(React.createElement(RewardsScreen, {
        theme, progress: { ...progress, badges },
      }));
      for (const badge of badges) {
        expect(html).toContain(badge.unlockHint(badge.goal));
      }
      expect(html).toContain(theme.lockedBadge.background);
      expect(html).toContain(theme.lockedBadge.ink);
      expect(html).toContain('data-icon="lock"');
    }
  });

  it('restores color and replaces the unlock hint when a badge is earned', () => {
    const theme = getTheme(false);
    const first = badges[0];
    if (!first) throw new Error('First badge is missing');
    const html = renderToStaticMarkup(React.createElement(RewardsScreen, {
      theme, progress: { ...progress, badges: [{ ...first, count: first.goal, earned: true }] },
    }));
    expect(html).toContain(theme.coral);
    expect(html).toContain('✓ Earned');
    expect(html).toContain('data-icon="check"');
    expect(html).not.toContain(first.unlockHint(first.goal));
    expect(html).not.toContain(theme.lockedBadge.background);
  });
});

describe('continuous background bubbles', () => {
  it('starts at the randomized position and closes every sway loop at its starting value', () => {
    renderToStaticMarkup(React.createElement(Bubbles, { theme: getTheme(false), animated: true }));
    const cleanups = harness.effects.map(effect => effect());
    expect(harness.styles).toHaveLength(ANIMATIONS.bubblesFloat.count);
    expect(harness.styles.some(style => style.transform[0]?.translateY?.initial !== 0)).toBe(true);
    expect(harness.loops).toHaveLength(ANIMATIONS.bubblesFloat.count);
    for (const { sequence } of harness.loops) {
      expect(sequence.at(-1)?.toValue).toBe(sequence[0]?.value.initial);
    }
    expect(harness.timings.every(timing => timing.isInteraction === false)).toBe(true);
    cleanups.forEach(cleanup => cleanup?.());
  });

  it.each([false, true])('uses the still layout without animation when motion is disabled: %s', reduced => {
    harness.animate = !reduced;
    renderToStaticMarkup(React.createElement(Bubbles, { theme: getTheme(false), animated: reduced }));
    expect(harness.effects).toHaveLength(0);
    expect(harness.styles).toHaveLength(0);
  });
});
