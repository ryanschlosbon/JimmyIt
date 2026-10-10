# apps/mobile/AGENTS.md

Rules for the Android app, on top of the root `AGENTS.md`. **Read
[`DESIGN.md`](DESIGN.md) before changing anything visible.** It is the design
system: colors, type, shapes, the header, the play screen, banners, bubbles and
animations.

## The short version

- **Colors** come from `theme` only (`src/design/palettes.ts`). No hex values in
  screens or components. A new look is a new `COLOR_STYLES` entry, not edits
  across screens.
- **Sizes, fonts and radii** come from `src/design/tokens.ts`. Tappable things
  are at least 56 × 56.
- **Every pressable** is a `Tappable` (or `Button`). No bare `Pressable`.
- **Every animation** is registered in `src/design/motion.ts`, marked
  `ANIMATION(<name>)` in the code, gated with `useAnimation('<name>')`, and stops
  for reduced motion.
- **New games on the play screen** are one `PLAY_SHELF` entry in `src/games.ts`
  plus an illustration in `components/GameArt.tsx` (DESIGN.md "Adding a game to
  the shelf").
- **Screens only render.** Game rules, scores and the toy connection come from
  `@jimmyit/app-kit` hooks and `games/*`; don't put logic in screens.
- **Check** your change at 375 × 812, 768 × 1024 and 1280 × 800: light and dark,
  the Calm style, and bubbles off. Then run `npm run check`.

## Map

```text
src/App.tsx               shell: header, bubbles, navigation, game runs, finish dialog
src/design/               palettes (colors), tokens (type, space, sizes), motion (animations)
src/theme.ts              getTheme(dark, styleId)
src/games.ts              game registry and the play-screen shelf (PLAY_SHELF)
src/use-jimmy.ts          screen-facing state over app-kit (connection, scores, appearance)
src/components/           Tappable, Controls, AppHeader, GameBanner, GameArt, PageDots, Bubbles, …
src/screens/              Play (home), Drawing, Timed Run, Tap Quest, Rewards, Settings, Intro
```
