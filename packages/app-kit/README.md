# @jimmyit/app-kit

The app's logic with no UI. Any design (the current screens, the redesign, a
tablet layout) gets the same behavior by rendering what these hooks return and
calling their functions. Owned by backend; changes to the exports are contract
changes (see AGENTS.md).

```
screens (any design)
   │  hooks: useConnection · useToyState · useScores · useGameRun
   ▼
@jimmyit/app-kit ── services: connection + score sync, repository, play(game)
   ▼
games (@jimmyit/game-*) ── game-sdk ── core ── protocol ── toy (Bluetooth or virtual)
```

## Setup (once, at the app root)

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJimmyServices, JimmyServicesProvider } from '@jimmyit/app-kit';

const services = createJimmyServices({ storage: AsyncStorage, connector });
<JimmyServicesProvider services={services}><App /></JimmyServicesProvider>
```

`connector` decides where the toy comes from:

| Build                         | Connector                                               |
| ----------------------------- | ------------------------------------------------------- |
| Development / web preview     | `createSimulatedToy().connector` from `@jimmyit/dev-toy`, plus `<DevToyPanel>` |
| Real toy                      | `createBluetoothConnector()` from `@jimmyit/ble-react-native` (see `apps/mobile/src/bluetooth.ts`) |
| No toy available              | `null`; `connect()` reports `error.kind = 'unavailable'` |

Nothing else changes between them. `apps/mobile/src/toy-connector.ts` makes the choice.

## Hooks

| Hook | Gives you | Typical screen |
| --- | --- | --- |
| `useConnection()` | `status` (`disconnected` / `searching` / `awaitingApproval` / `connected`), `info` (toy id, firmware), `lastSync`, `error.kind`, `connect()`, `disconnect()`, `clearError()` | Settings, header pill |
| `useToyState()` | Live toy state or `null`: switches, spinner angle, screw, `batteryPercent`, `charging` | Battery badge, live toy visualizer |
| `useScoreEvents(fn)` | Every score moment (`gameStart`, `points`, `milestone`, `newBest`, `gameEnd`) from app games *and* games the toy plays by itself while connected | Sounds, mascot reactions, confetti |
| `useCelebration()` | The big moment to show right now (`milestone`, `newBest`, `bestAtEnd`) or `null`; clears itself | An in-game celebration |
| `useReward()` | The level-up or new badge to show right now (`{ type: 'levelUp', level }` or `{ type: 'badge', badgeId }`) or `null`; rewards from one game take turns | A reward toast |
| `useScores({ games })` | `records`, `progress` (points, level, badges), `scoreboard` (per-game bests, today, toy vs app), `loading`, `error` | Rewards, scoreboard, home stats |
| `useGameRun()` | `start(game)`, `state`, `score`, `remainingMs`, `status`, `saveStatus`, `record`, `pause()`, `resume()`, `quit()`, `submit(action)`, `retrySave()`, `clear()` | Any game screen |

### A game screen in any design

```tsx
const run = useGameRun<TimedPracticeState>();
// start
run.start(createTimedPractice(60_000));
// draw
<Timer ms={run.remainingMs} /> <Moves value={run.state?.totalMoves} /> <Points value={run.score?.score} />
// controls
run.pause(); run.resume(); run.quit();
// result: run.record is the saved ScoreRecord; show run.record.score, run.record.stars, run.record.newBest
// if run.saveStatus === 'failed', offer run.retrySave()
```

Rules the hook enforces so every design behaves the same:
- Pausing stops the clock and ignores toy input; finishing early keeps every point.
- Input after the time limit never scores.
- Each run saves exactly one record, even if saving is retried.
- An unfinished run is quit (and saved) when the component holding the hook
  unmounts. Hold the hook in a component that outlives screen changes if the
  game should survive navigation, as `apps/mobile/src/App.tsx` does.
- `start()` throws `ToyNotConnectedError` for toy games when no toy is
  connected; use `services.canPlay(game)` to grey out buttons first.

### Connecting asks the child first

`status: 'awaitingApproval'` means the toy is showing "CONNECT TO <NAME>?" and
waiting for the child (left menu key = no, right = yes). Tell them to look at
the toy. The name comes from `createJimmyServices({ appName })`, and the app's
id is kept in storage (`APP_ID_STORAGE_KEY`) so the toy remembers this device.
A "no" (or no answer) ends as `error.kind === 'declined'`.

### Score moments

App games fire the same moments as the toy's own games (PROTOCOL.md "Score
events"), and the toy plays its animation and haptic for each. You don't
send anything: the runner watches the score. Screens just listen, with
`useScoreEvents` or `useCelebration` (see `apps/mobile/src/components/GameScoreBar.tsx`).

### Wording is yours

Errors come as kinds (`notFound`, `lost`, `versionMismatch`, `declined`,
`syncFailed`, `unavailable`), and badges as ids with counts. The app picks the
words, icons and colors (see `apps/mobile/src/use-jimmy.ts` and `badge-visuals.ts`).

## Without React

Everything also works without hooks: `createJimmyServices()`, `services.play(game)`
returns a `GameRun`, `getProgress(records)`, `getScoreboard(records, { games })`,
`createGameCatalog(games)`.

## Tests

`npm test` covers progress (levels, badges, local-day streaks), the scoreboard,
connecting, syncing offline toy games, cancelling a search, losing the toy, and
refusing to overwrite unreadable saves. The hooks are thin wrappers checked by
running the app (see `apps/mobile/README.md`).
