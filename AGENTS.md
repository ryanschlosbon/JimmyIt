# AGENTS.md

Instructions for everyone who changes this repo: people, Codex, Claude Code and
other coding agents. Read this file and the nearest nested `AGENTS.md` (for
example `games/AGENTS.md`) before you edit anything. If an instruction here
conflicts with a task, stop and ask; don't silently pick one.

## What this project is

JimmyIt is a handheld fidget toy for children and teens with motor differences.
They play minigames in an Android app to practise fine motor control. The toy
(Seeed XIAO nRF52840) talks to the app over Bluetooth Low Energy. The toy also
runs a few basic games by itself and syncs those scores to the app later.

Shared code is TypeScript, aimed at a React Native app. Firmware is C++ for the
Arduino nRF52 core.

## Repository map and ownership

| Path                         | What it is                                                      | Owner            |
| ---------------------------- | --------------------------------------------------------------- | ---------------- |
| `packages/protocol/`         | BLE wire format: `PROTOCOL.md`, codec, golden vectors           | Backend          |
| `packages/core/`             | Input handling, scoring, score storage, fidget sync, `FidgetClient` | Backend      |
| `packages/fake-fidget/`      | Simulated toy speaking the real protocol, for dev and tests     | Backend          |
| `packages/ble-react-native/` | `FidgetTransport` over react-native-ble-plx; the only BLE code  | Backend          |
| `packages/game-sdk/`         | **Contract**: what a game can see and do, plus the game runner  | Backend, reviewed by game authors and frontend |
| `games/<game-id>/`           | One minigame per folder                                         | That game's author |
| `apps/mobile/`               | The Android app: screens, navigation, game views (not created yet) | Frontend      |
| `firmware/`                  | XIAO nRF52840 firmware and its host tests                       | Backend          |

Backend is @ryanschlosbon. `.github/CODEOWNERS` enforces review by owner.

## Golden rules

1. **Stay in your area.** Change only the paths your task is about. If the task
   needs a change in someone else's area, stop and describe the change you
   need (in the PR or to the person who asked) instead of making it.
2. **Contracts change on purpose, never as a side effect.** The contracts are
   `packages/protocol` (including `PROTOCOL.md` and `vectors/`), the public API
   in each package's `src/index.ts`, and the `ScoreRecord` shape. Prefer
   additive changes. A breaking change needs review from every owner it
   affects.
3. **A protocol change touches four places in one PR:** `PROTOCOL.md`,
   `packages/protocol/src`, `firmware/jimmyit_fidget/src/fidget_protocol.h`,
   and `packages/protocol/vectors/v1.json`. Bump `PROTOCOL_VERSION` (TS and C++)
   for any change an older peer would misread.
4. **Green before you push:** `npm run check`, plus `npm run test:firmware` if
   you touched `firmware/` or `packages/protocol/`.
5. **Children's data stays on the device.** No network calls, analytics,
   crash reporters or third-party SDKs in shared packages or games. Cloud sync
   would be a separate, explicitly approved feature.

## Module boundaries

Enforced by `scripts/check-boundaries.mjs` (`npm run check:boundaries`).

```
games/<id> ──► @jimmyit/game-sdk ──► @jimmyit/core ──► @jimmyit/protocol
                     │ (testing.ts only)     ▲  ▲
                     └──► @jimmyit/fake-fidget ┘  │
                          @jimmyit/ble-react-native ┘
apps/mobile ──► game-sdk, core, ble-react-native, games/* (fake-fidget in dev builds)
firmware ══ PROTOCOL.md + vectors/v1.json ══ protocol   (no shared code; bytes are checked)
```

| Package                     | May import                                                     |
| --------------------------- | -------------------------------------------------------------- |
| `@jimmyit/protocol`         | nothing                                                        |
| `@jimmyit/core`             | `@jimmyit/protocol`                                            |
| `@jimmyit/fake-fidget`      | `@jimmyit/core`, `@jimmyit/protocol`                           |
| `@jimmyit/ble-react-native` | `@jimmyit/core`, `@jimmyit/protocol`                           |
| `@jimmyit/game-sdk`         | `@jimmyit/core`; `@jimmyit/fake-fidget` only in `src/testing.ts` |
| `games/*`                   | `@jimmyit/game-sdk`; `@jimmyit/game-sdk/testing` in tests; `react`, `react-native` in view files |
| `apps/*`                    | anything                                                       |

Also enforced:
- Import other packages by name only (`@jimmyit/core`), never by a relative
  path or into their `src/`.
- `protocol`, `core`, `fake-fidget` and `game-sdk` are platform-free: no
  `Buffer`, `process`, `require`, `window`, `document`, `node:*` or React
  Native imports, so they run unchanged in the app, in Node and in tests.
- Tests may import `vitest`. Any other third-party import must be allow-listed
  in the checker, which needs backend approval.

## How the pieces talk

1. `FidgetTransport` (raw bytes; BLE or fake) → `connectFidgetClient()` →
   `FidgetClient`.
2. `FidgetClient` decodes `input` packets with an `InputTracker` into
   `FidgetState` (what is true now) and `FidgetEvent`s (what just happened).
3. `startGame()` gives a game a `GameSession`, a narrow view of the client
   plus a `ScoreCounter`. When the game ends, the runner builds a
   `ScoreRecord`, saves it via `ScoreRepository`, and shows the score on the
   toy.
4. Fidget → app: `startScoreSync()` pulls games played on the toy
   (`syncFidgetRecords`) and saves live ones as they finish
   (`saveLiveFidgetRecords`).
5. App → fidget: `showScore`, `showText` and `showProgress` display
   app-computed results; `pushBestsToFidget` sends bests so the toy can
   celebrate offline.

## Where new things go

| You want to…                                   | Put it in                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| Add a minigame                                 | `games/<game-id>/`. Follow `games/AGENTS.md`.                           |
| Use a new toy input or output                  | `PROTOCOL.md` first, then firmware + codec + vectors, then `core`       |
| Add a scoring helper more than one game needs  | `packages/core/src/scoring/`, re-exported from `game-sdk/src/index.ts`  |
| Add a screen or UI component                   | `apps/mobile/`                                                          |
| Change what a saved score contains             | `core/src/scoring/types.ts` + bump `SCORE_SCHEMA_VERSION` with a migration |
| Change the toy's own games                     | `firmware/jimmyit_fidget/src/basic_modes.cpp` + `BASIC_MODES` in core  |

## TypeScript patterns

- **Strict TypeScript.** No `any`: use `unknown` and narrow. No `@ts-ignore`.
  Avoid `!` non-null assertions.
- **Factories, not classes.** Write `createThing(options): Thing`, where
  `Thing` is an exported interface. The only classes are `Error` subclasses.
- **No `enum`.** Use `as const` objects with a derived union type (see
  `CommandOpcode`, `SwitchBit`).
- **Named exports only**, except tool config files. A package's public API is
  exactly what its `src/index.ts` exports; everything else is private.
- **Discriminated unions** use a `type` field with camelCase string values
  (`{ type: 'switchDown', switchId }`).
- **Data is `readonly`.** Don't mutate arguments; return new objects.
- **Inject time.** Code that needs "now" or timers takes a `Clock` /
  `Scheduler`, defaulting to `systemClock` / `systemScheduler`. Never call
  `Date.now()`, `setTimeout` or `setInterval` directly in `core`, `game-sdk`
  or games. Tests use `createManualTime()`.
- **Subscriptions** are `onThing(listener): Unsubscribe`, built on
  `createEmitter`. No RxJS, no Node `EventEmitter`.
- **Bytes** are `Uint8Array` read and written little-endian (see
  `protocol/src/bytes.ts`). Never `Buffer`.
- **Errors** are `Error` subclasses named `SomethingError`. Validate at the
  edges (wire bytes, storage, game definitions) and trust data inside a
  package.
- **Async.** Return promises. Fire-and-forget only with an explicit
  `.catch(handler)`; never leave a promise floating silently.
- **Dependencies.** No new runtime dependencies in `protocol`, `core`,
  `fake-fidget` or `game-sdk` without backend approval. Dev tools go in the
  root `package.json`.
- **Comments** explain why, not what. Every export in a public `index.ts`
  gets a one-line JSDoc if its name alone isn't enough.
- **Formatting:** 2 spaces, single quotes, semicolons, trailing commas, lines
  up to about 120 characters. Match the file you are in.

## Naming

| Thing                               | Convention                                   | Example                                   |
| ----------------------------------- | -------------------------------------------- | ----------------------------------------- |
| TS files                            | kebab-case                                   | `score-repository.ts`                     |
| Tests                               | next to the code                             | `score-repository.test.ts`, `*.integration.test.ts` |
| React components (apps, game views) | PascalCase file and name                     | `SqueezeHoldView.tsx`                     |
| Types, interfaces                   | PascalCase, no `I` prefix                    | `ScoreRecord`, `FidgetClient`             |
| Functions, variables                | camelCase                                    | `syncFidgetRecords`                       |
| Factories / predicates / listeners  | `createX` / `isX`, `hasX` / `onX`            | `createScoreCounter`, `isSwitchDown`, `onEvent` |
| Converters                          | `xToY` or `toX`                              | `fidgetRecordToScoreRecord`               |
| Plain constants                     | SCREAMING_SNAKE_CASE                         | `PROTOCOL_VERSION`, `BASIC_MODES`         |
| `as const` lookup objects           | PascalCase object, camelCase keys            | `CommandOpcode.setTime`                   |
| Bit constants                       | `…Bit` = bit index; `…Flag`, `Capability` = mask | `SwitchBit.clicker = 0`, `InputFlag.charging = 0x02` |
| Game ids                            | kebab-case, unique, permanent                | `squeeze-hold`; `fidget-*` is reserved for toy modes |
| Packages                            | `@jimmyit/<kebab>`; games `@jimmyit/game-<id>` | `@jimmyit/game-squeeze-hold`            |
| Metrics in a `ScoreRecord`          | camelCase with a unit suffix                 | `longestHoldMs`                           |
| Units                               | always in the name                           | `durationMs`, `angleDeg`, `percent` (0-100), `level` (0-1), `…Raw` (sensor units) |
| Wire fields                         | identical in PROTOCOL.md, TS, C++, vectors   | `spinnerTotal`, `afterRecordId`           |
| Branches                            | `<area>/<short-description>`                 | `game/spin-race`, `backend/reconnect`     |

C++ (firmware): files `snake_case.cpp/.h`; types `PascalCase`; functions and
methods `camelCase`; constants `kPascalCase`; private members end in `_`;
constant groups live in namespaces named like the TS objects
(`CommandOpcode::kSetTime`). Wire structs use the spec's camelCase field names.

## Scoring and feedback rules (product rules)

These exist because the players are children with motor differences.

- Points are non-negative integers. A score never goes down during a game,
  and there are no penalties. A miss may reset a combo (`createCombo`) and
  nothing more.
- Give partial credit when it makes sense (`proximityPoints`) and use
  generous tolerances. A child who is trying should always see progress.
- Every game defines `starThresholds`; stars are 0-3.
- Haptics go through `Feedback` names (`tap`, `tick`, `success`, `celebrate`,
  `nudge`), never raw effect IDs in games, and nothing that feels like
  punishment. User-facing text is encouraging; no "fail", "wrong" or "lose".
- Every session, app or toy, becomes exactly one `ScoreRecord` and is saved
  only through `ScoreRepository`. Record ids are stable, so saves are
  idempotent.
- `ScoreRepository` refuses data with an unknown schema version. Never "fix"
  that by overwriting; write a migration.

## Protocol and firmware rules

- Payloads are at most 20 bytes, little-endian. Text is printable ASCII.
- New golden vector bytes must come from an independent tool (Python `struct`,
  as in the vectors' history), **never** from the TypeScript encoder; vectors
  exist to catch encoder bugs.
- Firmware logic that can be tested lives in `firmware/jimmyit_fidget/src/`
  with no Arduino headers, and is covered by `firmware/test`. Hardware glue
  (Bluefruit, Wire, sensors) lives in the sketch.
- In firmware: no dynamic allocation after setup, and no large objects on the
  stack (use statics). Return to `standalone` mode when the BLE link drops.

## Testing

- Each exported function has tests. Each bug fix adds a test that fails
  without the fix.
- Tests never depend on real time, real BLE or real storage. Use
  `createManualTime`, `createFakeFidget`, `createMemoryKeyValueStore` and
  `createGameTestHarness` (from `@jimmyit/game-sdk/testing`).

| Command                     | Does                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `npm install`               | Installs dev tools and links workspace packages (Node ≥ 20)   |
| `npm run check`             | Typecheck + boundary check + all TS tests                     |
| `npm test` / `npm run test:watch` | TS tests once / in watch mode                           |
| `npm run test:firmware`     | Builds and runs firmware host tests (needs `c++`, `python3`, `make`) |
| `npm run check:boundaries`  | Module boundary check only                                    |

## Git and pull requests

- Never commit directly to `main`. Branch as `<area>/<short-description>`,
  where area is `backend`, `frontend`, `game`, `firmware`, `protocol` or `docs`.
- One area per PR where possible. A PR that touches a contract says so in its
  title and lists the owners who need to review.
- Commit messages: `<area>: <imperative summary>`, e.g.
  `core: add combo helper`, `game/squeeze-hold: widen target band`.

## Extra rules for coding agents

- Before editing, read the files next to the one you are changing and copy
  their patterns.
- Do not edit `PROTOCOL.md`, `vectors/`, any `src/index.ts` public API,
  `scripts/check-boundaries.mjs` or `AGENTS.md` files unless the task is
  explicitly about them.
- Do not add dependencies, change tool configs or rename public symbols
  without asking.
- Before you finish, run the checks above and report the real results,
  including failures.

## Current status and open decisions

- App stack: React Native (TypeScript) for the shared packages; the app shell
  in `apps/mobile/` has not been created. When it is, add `"apps/*"` to the
  root `workspaces` and give `apps/mobile` an owner in CODEOWNERS.
- Firmware: the sketch runs the breadboard (one button on D0 plus the OLED)
  with Bluetooth, the Free Play game and flash storage. Code for the full toy
  sits behind flags in `board_config.h`; it compiles but hasn't run on
  hardware. Battery reading and a toy-side mode menu are not written yet.
- Squeeze calibration values are placeholders until the FSR is measured in
  the built toy.
- `ble-react-native` has not yet been run on a phone against real firmware.
