# Jimmy mobile

React Native + TypeScript + Expo SDK 57 frontend for Android tablets and phones,
with a browser preview. Node **22.13 or newer** is required for the mobile app.

## Run

From the repository root:

```sh
npm install
npm run web --workspace @jimmyit/mobile
```

For an Android development build, install Android Studio and its SDK, start an
emulator or attach a device, then run:

```sh
npm run android --workspace @jimmyit/mobile
```

This prototype simulates Bluetooth and calibration. It never requests Bluetooth
permissions or connects to real hardware. Expo Go can preview this UI; integrating
`@jimmyit/ble-react-native` later requires a native development build.

## Screens and state

- **Intro:** the supplied mint `JIMMY.png` transitions to coral `Jimmying.png` with
  a gentle crossfade and small zoom, then opens Home. It lasts about two seconds,
  has an always-available skip button, plays once per app launch, and becomes a
  short static welcome when reduced motion is enabled. Bundled artwork uses
  contain sizing so phone and tablet orientations do not crop the logo.
- **Home:** activity launcher, settings shortcut, persistent Home / Draw / Rewards navigation.
- **Draw:** finger, stylus, and mouse input; eight colors; brush sizes; whole-stroke undo;
  clear; completion celebration. Shape challenge opens the same canvas with a circle to trace.
  Drawing and shape drafts survive navigation separately, until completion or app reload.
- **Rewards:** real local score totals, levels (250 points each), six badge states, and progress.
  Each completed drawing earns 50 points; an empty attempt receives 10 points of partial credit.
  Drawing Pro takes ten drawings, Shape Star takes one shape attempt, and Week Streak tracks
  the longest run of consecutive local calendar days. Button Buddy and Super Spinner
  grow from real toy moves in timed practice (and spins from Spin Count on the toy). Games played on the
  toy without the app sync in and count too. The app never invents sample score records.
- **Tap Quest:** stylus game with Precision, Trace, Memory and Calm modes (`@jimmyit/game-tap-quest`).
  Difficulty continues from the child's last Tap Quest games. With the toy connected, the screen asks the
  child to take the stylus out of Jimmy, and pauses if it goes back in; Jimmy celebrates the score moments.
- **Timed practice:** 30-, 60-, or 90-second practice sessions that count every move on
  the toy (the demo buttons press the virtual toy). Five points per move, with ten points
  of partial credit for an empty attempt. Pause, resume, and finish early without penalties.
  Leaving the screen or switching apps pauses the session. Completed sessions use stable
  IDs and the shared score repository, including retry after a storage error.
- **Settings:** find / cancel / disconnect / reconnect, the toy's real name and battery,
  cancellable calibration, and persistent light / dark mode. Connection starts disconnected
  after a reload. Calibration never changes real hardware values.

Scores are created by the shared game runner (`useGameRun`) and saved only through
the shared `ScoreRepository`, backed by AsyncStorage. Each run saves one record, so
retrying a failed save can never double-count.
Unsupported saved score schemas are preserved and reported, never overwritten.
Appearance is saved separately as `jimmy.appearance`. All data stays on the device;
fonts are bundled and there are no analytics or remote services.

All app logic comes from `@jimmyit/app-kit` hooks and the `@jimmyit/game-*`
packages (see `packages/app-kit/README.md`); screens only render, so a redesign
replaces screens without touching scoring, saving or the toy connection.

Where the toy comes from (`src/toy-connector.ts`):

| Build | Toy |
| --- | --- |
| Web preview | Virtual toy (tap **Toy** in the corner) |
| Development build | Virtual toy, or the real toy with `EXPO_PUBLIC_JIMMY_TOY=bluetooth npm run android --workspace @jimmyit/mobile` |
| Release build | Real toy over Bluetooth (`react-native-ble-plx`, needs a development or release build, not Expo Go) |

Connecting asks the child on the toy first ("Say yes on Jimmy ▶" in the
header). Big score moments (every 100 points, a new high score), from app
games or the toy's own games, show `src/components/CelebrationOverlay.tsx`,
which is a placeholder look driven by app-kit's `useCelebration()`.

## Files

```text
index.ts                    registered Expo entry point (named App export)
src/App.tsx                 app shell, services provider, navigation, drafts, completion dialog
src/screens/                Intro, Home, Drawing, Timed practice, Rewards, Settings
src/components/             controls, vector Jimmy, icons, vector drawing canvas
src/use-jimmy.ts            screen-facing state over app-kit hooks: wording, appearance, calibration demo
src/games.ts                game registry: which games the app offers
src/toy-connector.ts        virtual toy in development / web previews; Bluetooth later
src/badge-visuals.ts        icon and color for each badge id
src/artwork.ts               editable image slots and intro background colors
assets/                      supplied intro compositions and your replacement artwork
src/theme.ts                 light / dark tokens
```

Scoring rules, drawing strokes, timed practice and rewards moved out of this
folder into `games/drawing`, `games/timed-practice` and `packages/app-kit`
(with their tests). Set the frontend owner's GitHub username in CODEOWNERS when
the team identifies that owner.

## Validation

```sh
npm run check
npm run typecheck --workspace @jimmyit/mobile
npm run test --workspace @jimmyit/mobile
npm run export:web --workspace @jimmyit/mobile
```

Root checks cover the original shared packages and games. The separate mobile
commands cover the new app. Firmware tests are required only for firmware or
protocol changes, neither of which is part of this frontend.

Manual checks: intro / skip / reduced motion; navigation; draw / tap / undo / clear; brush and color selection;
shape prompt; completion and saved points; earned / locked / in-progress badges;
reload with saved dark mode; search / cancel / reconnect; calibration; keyboard
focus; timed practice / pause / resume / early finish / automatic completion;
and tablet / phone layouts. A native Android emulator or device is still
needed to validate stylus and touch behavior on Android hardware.

The UI uses 56px or larger controls, visible focus rings, text plus icons for
states, and no flashing. Only the brief, skippable intro moves automatically.
Secondary labels use 14–18px where
24px would make compact controls impractical; main copy uses 24px and larger.
The canvas uses normalized vector coordinates and a palette visible on both backgrounds.

Expo monorepo setup follows the [official monorepo guide](https://docs.expo.dev/guides/monorepos/).

See [ARTWORK-GUIDE.md](ARTWORK-GUIDE.md) to replace illustrations without changing layouts.
