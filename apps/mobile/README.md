# apps/mobile: the Android app (frontend)

Owner: frontend. Not created yet. This folder is reserved so the frontend has
a clear home.

## When you create the app

1. Create a React Native project here, Expo with a development build or bare
   RN. BLE needs native code, so Expo Go won't work.
2. Add `"apps/*"` to `workspaces` in the root `package.json`, and add your
   username for `/apps/` in `.github/CODEOWNERS`.
3. Depend on the workspace packages you need: `@jimmyit/core`,
   `@jimmyit/game-sdk`, `@jimmyit/ble-react-native`, the `@jimmyit/game-*`
   packages, and `@jimmyit/fake-fidget` for dev builds.
4. Workspace packages ship TypeScript source (`exports` points at
   `src/index.ts`). Make sure Metro resolves the monorepo; recent Expo SDKs do
   this automatically.

## What backend gives you

- **Connecting:** `scanForFidgets`, `connectToFidget` (`@jimmyit/ble-react-native`),
  then `connectFidgetClient` (`@jimmyit/core`). Wiring example in
  `packages/ble-react-native/README.md`.
- **No hardware?** Use `createFakeFidget().transport` instead of
  `connectToFidget`. A debug panel can call `fake.press('clicker')`,
  `fake.spin(90)`, `fake.squeeze(0.5)` and so on.
- **Live toy state:** `client.getState()`, `client.onState()`, `client.onEvent()`.
- **Running a game:** `startGame(game, { device: client, repository })` returns
  a `GameRun`. The game screen renders `run.getState()`, re-renders on
  `run.subscribe()`, and awaits `run.result` for the saved `ScoreRecord`.
- **Scores:** `createScoreRepository(AsyncStorage)`, then `list()`, `best()`,
  `summary()` and `onChange()`.
- **Sync after connect:** `startScoreSync(client, repository)`.

## Game registry

Keep the list of available games in one file here (for example
`src/games.ts`, importing each `@jimmyit/game-*` package). Game authors add
one line to it in their PRs.
