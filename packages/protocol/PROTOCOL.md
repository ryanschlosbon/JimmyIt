# JimmyIt fidget BLE protocol, version 1

This file is the contract between the fidget firmware (`firmware/`) and the app
(`packages/*`). The TypeScript codec (`packages/protocol/src`), the C++ header
(`firmware/jimmyit_fidget/src/fidget_protocol.h`) and the golden vectors
(`packages/protocol/vectors/v1.json`) must all agree with it. Change all four in
one pull request, or none.

## Rules that apply everywhere

- All multi-byte integers are **little-endian**.
- Every payload is **at most 20 bytes**. That fits the default BLE ATT MTU (23),
  so no MTU negotiation is needed on any Android phone.
- Text is printable ASCII (0x20-0x7E), no terminator, and the length comes from
  the payload length. Senders replace other characters with `?` and truncate to
  the stated maximum.
- Field names below are used verbatim in TypeScript, C++ and the vectors.
- A receiver that sees an unknown opcode or a wrong length replies with an
  `error` message (fidget) or ignores the packet and reports it (app). It never
  crashes.

## GATT layout

One primary service. All UUIDs share the base
`59e5XXXX-3be2-4d9c-9607-646ddb5d9770`, where `XXXX` is:

| XXXX | Name      | Properties                     | Direction    | Payload            |
| ---- | --------- | ------------------------------ | ------------ | ------------------ |
| 0001 | service   | —                              | —            | —                  |
| 0002 | `input`   | read, notify                   | fidget → app | input packet       |
| 0003 | `command` | write, write without response  | app → fidget | command            |
| 0004 | `message` | notify                         | fidget → app | message            |
| 0005 | `info`    | read                           | fidget → app | device info        |

**Advertising:** the advertisement carries flags plus the full 128-bit service
UUID (21 of 31 bytes), so the app can scan with a service filter. The device
name `JimmyIt` goes in the scan response.

## `input` packet (18 bytes)

The firmware notifies `input` when any field other than `timeMs` changes, at most
50 times per second, plus a heartbeat at least once per second. Counters are
cumulative, so the app derives movement by diffing two packets. A lost packet
loses timing detail but no movement.

| Offset | Type | Field            | Meaning                                                            |
| -----: | ---- | ---------------- | ------------------------------------------------------------------ |
|      0 | u8   | `seq`            | Increments by 1 per notification, wraps at 255. Gaps = lost packets. |
|      1 | u8   | `mode`           | `FidgetMode` (below).                                              |
|      2 | u16  | `switches`       | Bitfield of switches currently closed (`SwitchBit`).               |
|      4 | u16  | `pressed`        | Bits that closed at any moment since the previous packet. Catches taps shorter than one packet. |
|      6 | i32  | `spinnerTotal`   | AS5600 spinner position, cumulative, 4096 counts per turn. Clockwise from the left = positive. |
|     10 | i16  | `screwTotal`     | Captive-screw encoder, cumulative detents (24 per turn, `SCREW_DETENTS_PER_TURN`), wraps. Tighten = positive. |
|     12 | u16  | `reserved`       | Always 0. (Was the squeeze sensor, removed from the toy.)          |
|     14 | u16  | `timeMs`         | Low 16 bits of the fidget's millisecond clock. Used for durations. |
|     16 | u8   | `batteryPercent` | 0-100, or 255 = unknown.                                           |
|     17 | u8   | `flags`          | `InputFlag` bits (below).                                          |

### `SwitchBit` (bit index in `switches` / `pressed`)

| Bit | Name           | Hardware (MCP23017 pin)                  | Kind        |
| --: | -------------- | ---------------------------------------- | ----------- |
|   0 | `clicker`      | S1 top clicker, GPB7                     | momentary   |
|   1 | `navLeft`      | S2 menu key, GPA0. "No" in prompts       | momentary   |
|   2 | `navRight`     | S3 menu key, GPA1. "Yes" in prompts      | momentary   |
|   3 | `rocker`       | S4 rear rocker (not wired yet)            | latching    |
|   4 | `screwHome`    | S5 screw fully in (not wired yet)        | limit       |
|   5 | `screwOut`     | S6 screw fully out (not wired yet)       | limit       |
|   6 | `sliderLow`    | S7 slider bottom end, GPB5               | limit       |
|   7 | `sliderHigh`   | S8 slider top end, GPB6                  | limit       |
|   8 | `stylusStowed` | S9 stylus in its bay (not wired yet)     | limit       |
|   9 | reserved       | Always 0. (Was the shirt-button flap, removed.) |    |
|  10 | `screwPush`    | Captive-screw encoder's push switch, GPA2 | momentary  |
| 11-15 | reserved     | always 0                                 |             |

Older apps ignore bits they don't know, so new switch bits don't change
`protocolVersion`.

### `FidgetMode`

| Value | Name         | Who drives the display and haptics                         |
| ----: | ------------ | ---------------------------------------------------------- |
|     1 | `standalone` | The fidget: its own menu and basic games. Default at boot. |
|     2 | `app`        | The app: the fidget only shows what the app sends, and plays the app's `haptic` and `scoreEvent` commands. |

The fidget returns to `standalone` by itself when the BLE link drops, so a
child is never left with a frozen screen.

**Input feedback is always the toy's own**, in both modes and while it asks
"connect?", so it has no Bluetooth delay: a sharp tap (effect 4) the moment a
button, a slider end, the rocker (either way) or the screw's push closes, and a
rumble while the spinner or the screw turns (DRV2605L real-time playback,
stronger the faster it turns, gone about 150 ms after it stops). Effect
sequences (celebrations, `haptic` commands) take priority over the rumble,
which resumes when they finish; a tap never cuts a celebration short. Apps
should not send a haptic just to confirm a press.

### `InputFlag`

| Bit | Name             | Meaning                                         |
| --: | ---------------- | ----------------------------------------------- |
|   0 | `clockSet`       | The app has sent `setTime` since power-on.      |
|   1 | `charging`       | USB power present and the cell is charging.     |
|   2 | `standaloneGame` | A standalone basic game is running right now.   |
|   3 | `awaitingApproval` | A phone is connected but the child hasn't said yes yet. |

## `command` (app → fidget)

The first byte is the opcode. Write with response unless noted.

| Opcode | Name           | Payload after opcode                                    | Bytes |
| -----: | -------------- | ------------------------------------------------------- | ----: |
|   0x01 | `setTime`      | u32 `unixSeconds`                                        |     5 |
|   0x02 | `setMode`      | u8 `mode` (`FidgetMode`)                                 |     2 |
|   0x03 | `hello`        | u32 `appId`, then 0-15 ASCII chars `name` (shown on the toy) | 5-20 |
|   0x10 | `haptic`       | 1-8 × u8 `effects`, DRV2605L ROM effect IDs 1-123, played in order |  2-9 |
|   0x20 | `showText`     | u8 `line` (0-3), then 0-18 ASCII chars `text`. Empty clears the line. |  2-20 |
|   0x21 | `showScore`    | u32 `score`, u32 `best` (0 = none), u8 `stars` (0-3)     |    10 |
|   0x22 | `showProgress` | u8 `percent` (0-100), then 0-18 ASCII chars `label`      |  2-20 |
|   0x23 | `clearDisplay` | —                                                        |     1 |
|   0x24 | `scoreEvent`   | u8 `kind` (`ScoreEventKind`), u32 `score`, u32 `value`   |    10 |
|   0x30 | `syncRequest`  | u32 `afterRecordId`                                      |     5 |
|   0x31 | `syncAck`      | u32 `upToRecordId`                                       |     5 |
|   0x32 | `setBest`      | u8 `modeId`, u32 `score`                                 |     6 |

Display commands only take effect in `app` mode. In `standalone` mode the
firmware ignores them without an error, because the fidget owns its own screen.
`haptic` and `scoreEvent` work in both modes.

Until the child approves the phone (see "Connecting"), every command except
`hello` gets an `error` with code `notApproved`.

## `message` (fidget → app)

The first byte is the message type.

| Type | Name       | Payload after type                                                                 | Bytes |
| ---: | ---------- | ---------------------------------------------------------------------------------- | ----: |
| 0x01 | `record`   | u32 `recordId`, u8 `modeId`, u8 `flags` (`RecordFlag`), u32 `startUnix`, u16 `durationS`, u32 `score`, u16 `actions` | 19 |
| 0x02 | `syncDone` | u32 `newestRecordId` (0 = log empty), u16 `sentCount`                              |     7 |
| 0x03 | `scoreEvent` | u8 `kind`, u8 `modeId` (`BasicModeId`), u32 `score`, u32 `value`: a moment in a game the toy is running by itself | 11 |
| 0x04 | `approval` | u8 `status` (`ApprovalStatus`: 0 declined, 1 accepted, 2 waiting for the child)     |     2 |
| 0x7F | `error`    | u8 `code` (`ErrorCode`), u8 `opcode` that failed                                    |     3 |

### `RecordFlag`

| Bit | Name        | Meaning                                                                 |
| --: | ----------- | ----------------------------------------------------------------------- |
|   0 | `clockSet`  | `startUnix` is real Unix time. If clear, the app treats the time as approximate. |
|   1 | `completed` | The game ran to its end rather than being cancelled.                    |
|   2 | `newBest`   | The score beat the best the fidget knew about at the time.              |

### `ErrorCode`

| Value | Name            |
| ----: | --------------- |
|     1 | `unknownOpcode` |
|     2 | `badLength`     |
|     3 | `badValue`      |
|     4 | `busy`          |
|     5 | `notApproved`   |

## `info` (16 bytes, read)

| Offset | Type | Field               |
| -----: | ---- | ------------------- |
|      0 | u8   | `protocolVersion` (this document: 1) |
|      1 | u8   | `firmwareMajor`     |
|      2 | u8   | `firmwareMinor`     |
|      3 | u8   | `firmwarePatch`     |
|      4 | u32  | `deviceId` (nRF52840 FICR DEVICEID[0]) |
|      8 | u16  | `capabilities` (`Capability` bits) |
|     10 | u32  | `newestRecordId`    |
|     14 | u16  | `storedRecordCount` |

`Capability`: bit 0 `haptics`, bit 1 `display`, bit 2 `scoreLog`, bit 3
`standaloneModes`, bit 4 `scoreEvents`, bit 5 `approval`.

The app refuses to talk to a fidget whose `protocolVersion` differs from its own,
and tells the user that the app or firmware needs an update.

## Connecting: the child says yes on the toy

A phone can't use the toy until the child agrees on the toy itself.

1. The app connects, reads `info`, subscribes to `message`, and (if `info`
   has the `approval` capability) writes `hello(appId, name)`. `appId` is a
   random number the app picks once per install and keeps; `name` is shown on
   the toy ("CONNECT TO RYAN'S PIXEL?").
2. If the toy already approved this `appId`, it replies `approval(accepted)`
   straight away.
3. Otherwise it replies `approval(waiting)`, sets the `awaitingApproval` input
   flag and shows the question. **Left menu key (`navLeft`) = no, right
   (`navRight`) = yes.** On a breadboard with only the clicker, the clicker
   means yes. No answer in 30 s counts as no.
4. Yes → `approval(accepted)`; the toy remembers the `appId` (up to 8 phones,
   in flash) so it won't ask that phone again. No → `approval(declined)`, then
   the toy disconnects.
5. A phone that connects without sending `hello` within 2 s (for example nRF
   Connect) is asked about as "A PHONE" and is not remembered.

Until accepted, the toy sends no `input` notifications and answers every other
command with `error(notApproved)`. This is consent, not security: `appId` is
not secret. Holding both menu keys for 5 s on the toy's ready screen forgets
every remembered phone.

## Score events

Both the toy and the app celebrate the same moments in a game. Whoever runs
the game decides when they happen, using these rules:

| Kind (`ScoreEventKind`) | When | `value` |
| --- | --- | --- |
| 1 `gameStart` | The game starts | best score before this game (0 = none) |
| 2 `points`    | The score goes up | points just added |
| 3 `milestone` | The score reaches 100, 500, 1000, 1500, 2000, 3000, then every 1000 (4000, 5000, …). `MILESTONE_SCORES`, `nextMilestoneAfter` | the milestone reached, e.g. 500 |
| 4 `newBest`   | The score first passes the previous best, if there was one | the best that was just beaten |
| 5 `gameEnd`   | The game ends | best score before this game |

`score` is always the game's total after the event. One score increase can
produce `points`, then any `milestone`s, then `newBest`, in that order.

- **App game, toy connected:** the app sends `scoreEvent` commands. It may
  merge `points` events that arrive within 150 ms into one.
- **Toy game, phone connected:** the toy sends `scoreEvent` messages, so the
  app can celebrate too. They don't replace the `record` at the end.

What the toy does for each (firmware `celebration.cpp`; DRV2605L effect ids,
named in "DRV2605L effects" below). `gameStart` and `points` have no haptic:
the move that caused them already got the toy's own tap or rumble.

| Kind | Toy screen | Haptic |
| --- | --- | --- |
| `gameStart` | "GO!" burst (0.7 s) | none |
| `points` | "+N" pops up in the corner (0.35 s) | none |
| `milestone` | sparkles + "AMAZING JOB! N POINTS" (2 s) | grows with the milestone: 100 → 10; 500 → 12; 1000-2000 → 12, 47; 3000 and up → 12, 14 |
| `newBest` | flashing "NEW HIGH SCORE!" with expanding rings (2.5 s) | 14, 12, 14 (the strongest) |
| `gameEnd` | the result screen: the score with sparkles, then Jimmy rolls in, pushes it aside, smiles and hops; "NEW BEST!" if it was (4.2 s) | 10, or 12, 14 if it was a new best |

A bigger animation is never cut short by a smaller one (`newBest` >
`milestone` > `gameEnd` > `gameStart` > `points`).

## Scores in both directions

### Fidget → app (standalone play)

1. The fidget runs its own basic games (`BasicModeId` below) with no phone
   present and scores them on the device.
2. Each finished game is stored in a flash-backed ring log, at least 32 entries (the firmware keeps 200).
   `recordId` starts at 1, increases by 1 per game, and survives power cycles.
   When the log is full the oldest entry is overwritten.
3. On connect, the app reads `info`, sends `setTime`, then sends
   `syncRequest(afterRecordId = last id the app saved for this deviceId)`.
4. The fidget sends one `record` message per stored entry with
   `recordId > afterRecordId`, oldest first, then `syncDone`.
5. After saving, the app sends `syncAck(upToRecordId)`. The fidget uses the ack
   only to show "synced" status. It does not delete entries.
6. If a standalone game finishes while connected, the fidget also sends its
   `record` immediately, unprompted.
7. Saving is idempotent. The app's record id for a fidget game is
   `fidget-<deviceId hex>-<recordId>-<startUnix>`, so a resend is ignored. If
   `info.newestRecordId` is smaller than the app's cursor, the log was reset
   (reflash), and the app syncs from 0.

### App → fidget (results the app computed)

- `showScore` and `showProgress` put app-computed results on the OLED.
- `setBest(modeId, score)` tells the fidget the best score the app knows for a
  basic mode, so the fidget can celebrate a new best while offline. The
  firmware keeps the higher of its own best and this value.
- `setMode(app)` hands the screen to the app while an app game runs.
  `setMode(standalone)` hands it back.

### `BasicModeId` (games the fidget runs on its own)

| Id | Name        | App game id         | Rules (firmware `basic_modes.cpp` is the authority) |
| -: | ----------- | ------------------- | ---------------------------------------------------- |
|  1 | `freePlay`  | `fidget-free-play`  | The default game. The first move starts it and scores. +10 per press, rocker flip, slider end or stylus out; +5 per 90° spin or screw quarter turn (see "One move"). |
|  2 | `spinCount` | `fidget-spin-count` | Needs the spinner or the screw. The first move starts it. Only turning scores: +5 per 90° spin or screw quarter turn, either direction. `actions` counts those turns. |

Both games end the same way, with no fixed clock: after 2 s with no move the
toy shows a bar that runs down for 1 s; a move then carries on as normal, and
otherwise the game ends (`completed`). No game runs longer than 3 min. The toy
celebrates milestones (see "Score events").

Ids 1-63 are reserved for firmware basic modes.

**One move** means the same on the toy and in the app (firmware `BasicGame::countMoves`,
app `createToyActionTracker`): a press of the clicker, a menu key or the screw knob, the rocker
flipping either way, a slider end, taking the stylus out, a 90° spin of the
spinner, or a quarter turn of the screw (6 of its 24 detents). Spins and screw
turns are measured from the last counted position, so sensor jitter or
wiggling the screw by a detent never adds up. Screw limit switches and putting
the stylus back are positions, not moves.

The toy stores up to 200 finished games in flash until the app syncs them; when
full, the oldest is overwritten.

## DRV2605L effects

Every ROM effect the app and the toy use, verified against the TI datasheet
effect list (ROM library; use library 6 for the LRA).
`packages/core/src/device/feedback.ts` names them for the app (`HapticEffect`,
`Feedback`); the firmware uses them in `celebration.cpp` and `haptic_feedback.h`.

| Id | Datasheet name                         | Used for |
| -: | -------------------------------------- | -------- |
|  1 | Strong Click - 100%                    | app `levelUp` (1, 1, 14) |
|  4 | Sharp Click - 100%                     | toy: a press (input tap) |
|  7 | Soft Bump - 100%                       | app `tap`; toy: "connect?" asks for attention |
| 10 | Double Click - 100%                    | app `success`; toy: milestone 100, game end |
| 12 | Triple Click - 100%                    | app `celebrate` (12, 14); toy: milestones from 500, new best, game end with a best |
| 14 | Strong Buzz - 100%                     | app `celebrate`, `levelUp`; toy: milestones from 3000, new best |
| 24 | Sharp Tick 1 - 100%                    | app `tick`, `nudge` |
| 37 | Long Double Sharp Click Strong 1 - 100% | app `badge` (37, 37) |
| 47 | Buzz 1 - 100%                          | toy: milestones 1000-2000 |

The toy's rumble is not a ROM effect: it is real-time playback (RTP) with the
amplitude set from the turning speed.
