# JimmyIt

A handheld fidget toy for children and teens with motor differences, with an
Android app of minigames that reward fine motor practice. The toy runs on a
Seeed XIAO nRF52840 and talks to the app over Bluetooth Low Energy. It also
plays and scores a few games by itself, then syncs them to the app.

**Contributors and coding agents: read [AGENTS.md](AGENTS.md) first.** It
covers ownership, module boundaries, patterns and naming.

## Layout

```
packages/protocol/          BLE wire format: PROTOCOL.md, codec, golden vectors
packages/core/              input handling, scoring, score storage, toy⇄app score sync
packages/fake-fidget/       simulated toy for development and tests
packages/ble-react-native/  real Bluetooth transport (react-native-ble-plx)
packages/game-sdk/          what a minigame can use, game runner, test harness
games/squeeze-hold/         example minigame
apps/mobile/                Android app (frontend, not created yet)
firmware/                   XIAO nRF52840 firmware modules + host tests
```

## Getting started

Needs Node.js 20 or newer. For firmware tests you also need `c++`, `make`
and `python3`, which come with the Xcode command line tools on macOS.

```bash
npm install
npm run check          # typecheck, module boundaries, tests
npm run test:firmware  # firmware host tests against the same golden vectors
```

## Key documents

- [AGENTS.md](AGENTS.md): rules for everyone who edits the repo
- [games/AGENTS.md](games/AGENTS.md): how to write a minigame
- [packages/protocol/PROTOCOL.md](packages/protocol/PROTOCOL.md): the BLE contract
- [firmware/README.md](firmware/README.md): firmware status and pin map
- [apps/mobile/README.md](apps/mobile/README.md): what the frontend gets
