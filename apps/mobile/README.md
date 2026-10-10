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
  grow from the actual action counts in timed demo sessions. The app never invents sample score records.
- **Timed practice:** 30-, 60-, or 90-second practice sessions with frontend demo controls
  for button presses, dial spins, and squeezes. Five points per action, with ten points
  of partial credit for an empty attempt. Pause, resume, and finish early without penalties.
  Leaving the screen or switching apps pauses the session. Completed sessions use stable
  IDs and the shared score repository, including retry after a storage error.
- **Settings:** find / cancel / disconnect / reconnect simulation, sample 84% battery,
  cancellable calibration, and persistent light / dark mode. Connection starts disconnected
  after a reload. Calibration never changes real hardware values.

Scores are created with `createAppScoreRecord` and saved only through the shared
`ScoreRepository`, backed by AsyncStorage. Stable drawing IDs make retries idempotent.
Unsupported saved score schemas are preserved and reported, never overwritten.
Appearance is saved separately as `jimmy.appearance`. All data stays on the device;
fonts are bundled and there are no analytics or remote services.

Development builds connect the UI demo through `@jimmyit/fake-fidget` and
`connectFidgetClient`. Production previews use UI-only simulation. Actual BLE,
toy-score synchronization, and SDK game views are future integration work.

## Files

```text
index.ts                    registered Expo entry point (named App export)
src/App.tsx                 app shell, navigation, drafts, completion dialog
src/screens/                Intro, Home, Drawing, Timed practice, Rewards, Settings
src/components/             controls, vector Jimmy, icons, vector drawing canvas
src/use-jimmy.ts             appearance, score loading, simulated connection lifecycle
src/progress.ts              score persistence and derived rewards
src/drawing.ts               immutable vector strokes and undo
src/timed-challenge.ts       injected timer, pause/resume, action counts, completion
src/artwork.ts               editable image slots and intro background colors
assets/                      supplied intro compositions and your replacement artwork
src/theme.ts                 light / dark tokens
```

Only `apps/mobile`, root workspace registration, and the lockfile are changed.
Shared modules, contracts, firmware, and ownership rules are untouched. Set the
frontend owner's GitHub username in CODEOWNERS when the team identifies that owner;
the existing owner is retained rather than guessing a username.

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
