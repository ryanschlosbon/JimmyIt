# games/AGENTS.md

Rules for minigames, on top of the root `AGENTS.md`. `squeeze-hold/` is the
reference example; copy its shape.

## Layout of one game

```
games/<game-id>/
├── package.json            name "@jimmyit/game-<game-id>", depends only on "@jimmyit/game-sdk"
├── README.md               what the child does, which hand skill, how points work
└── src/
    ├── index.ts            exports the definition and its state type, nothing else
    ├── <game-id>.ts        rules: defineGame({...}); no React, no UI
    ├── <game-id>.test.ts   tests through createGameTestHarness
    └── <GameId>View.tsx    the React Native view (once apps/mobile exists)
```

## Imports

- Rules files (`<game-id>.ts`) import only from `@jimmyit/game-sdk`.
- View files may also import `react` and `react-native`.
- Tests import `@jimmyit/game-sdk/testing` and `vitest`.
- Never import from `@jimmyit/core`, another game, `apps/` or BLE code. If
  `game-sdk` lacks something you need, ask backend to add it there.

## Writing the rules

- `create(session)` returns `{ getState, onStart?, onEvent?, onTick?, onFinish? }`.
  Keep all game state inside that closure.
- React to discrete input in `onEvent` (`switchDown`, `spin`, `screw`,
  `squeezeStart`…). Read continuous input (squeeze level, spinner angle)
  from `session.getInput()` in `onTick`.
- Use `onTick(elapsedMs)` for anything time-based. Never call `setTimeout`,
  `setInterval` or `Date.now()`.
- Score only with `session.score.add()`. Count interactions with
  `countAction()`. Record game-specific numbers with
  `setMetric` / `maxMetric` (camelCase plus unit: `longestHoldMs`).
- Feedback only with `session.feedback('tap' | 'tick' | 'success' | 'celebrate' | 'nudge')`.
- Set `durationMs` for fixed-length games, or `null` and call
  `session.finish()`. The runner saves the score, shows it on the toy and
  plays the end-of-game haptic. Don't do those yourself.
- `onEvent` can fire about 50 times a second and `onTick` 20 times a
  second, so keep both cheap.
- `getState()` returns plain data the view needs to draw (numbers, booleans,
  short strings), not functions or classes.

## Designing for the players

- Generous tolerances and partial credit (`proximityPoints`). Scores only go
  up; no penalties, no "fail" screens or wording.
- Playable one-handed. If a game needs two controls at once, say so in its
  README and `skills`.
- No flashing faster than 3 times a second, and no sudden loud or harsh
  feedback.
- List every hand skill the game practices in `skills`.

## Testing a game

```ts
import { createGameTestHarness } from '@jimmyit/game-sdk/testing';

const h = await createGameTestHarness(myGame);
h.fidget.squeeze(0.5);  // or press / tap / spin / turnScrew
h.advance(5_000);       // game time, deterministic
expect(h.run.getScore().score).toBe(50);
const record = await h.playToEnd();
```

Cover at least: points for the intended action, no points for doing nothing,
the end condition, and the saved `ScoreRecord` (score, stars, metrics).

## Registering a game

The list of games shown in the app lives in `apps/mobile` (frontend's area).
Your PR adds one import and one list entry there and requests frontend
review. Nothing else in `apps/` changes.
