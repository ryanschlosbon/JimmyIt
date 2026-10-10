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
|     10 | i16  | `screwTotal`     | Captive-screw encoder, cumulative detents, wraps. Tighten = positive. |
|     12 | u16  | `squeezeRaw`     | FSR ADC reading, 12-bit (0-4095). Higher = harder squeeze.          |
|     14 | u16  | `timeMs`         | Low 16 bits of the fidget's millisecond clock. Used for durations. |
|     16 | u8   | `batteryPercent` | 0-100, or 255 = unknown.                                           |
|     17 | u8   | `flags`          | `InputFlag` bits (below).                                          |

### `SwitchBit` (bit index in `switches` / `pressed`)

| Bit | Name           | Hardware (D4 wiring)                     | Kind        |
| --: | -------------- | ---------------------------------------- | ----------- |
|   0 | `clicker`      | S1 top clicker, MCP23017 GPA0            | momentary   |
|   1 | `navUp`        | S2, GPA1                                 | momentary   |
|   2 | `navDown`      | S3, GPA2                                 | momentary   |
|   3 | `rocker`       | S4 rear rocker, GPA3                     | latching    |
|   4 | `screwHome`    | S5 screw fully in, GPA4                  | limit       |
|   5 | `screwOut`     | S6 screw fully out, GPA5                 | limit       |
|   6 | `sliderLow`    | S7 slider bottom end, GPB0               | limit       |
|   7 | `sliderHigh`   | S8 slider top end, GPB1                  | limit       |
|   8 | `stylusStowed` | S9 stylus in its bay, GPB2               | limit       |
|   9 | `flapButtoned` | Shirt-button flap contacts, GPA6         | contact     |
| 10-15 | reserved     | always 0                                 |             |

### `FidgetMode`

| Value | Name         | Who drives the display and haptics                         |
| ----: | ------------ | ---------------------------------------------------------- |
|     1 | `standalone` | The fidget: its own menu and basic games. Default at boot. |
|     2 | `app`        | The app: the fidget only shows what the app sends.         |

The fidget returns to `standalone` by itself when the BLE link drops, so a
child is never left with a frozen screen.

### `InputFlag`

| Bit | Name             | Meaning                                         |
| --: | ---------------- | ----------------------------------------------- |
|   0 | `clockSet`       | The app has sent `setTime` since power-on.      |
|   1 | `charging`       | USB power present and the cell is charging.     |
|   2 | `standaloneGame` | A standalone basic game is running right now.   |

## `command` (app → fidget)

The first byte is the opcode. Write with response unless noted.

| Opcode | Name           | Payload after opcode                                    | Bytes |
| -----: | -------------- | ------------------------------------------------------- | ----: |
|   0x01 | `setTime`      | u32 `unixSeconds`                                        |     5 |
|   0x02 | `setMode`      | u8 `mode` (`FidgetMode`)                                 |     2 |
|   0x10 | `haptic`       | 1-8 × u8 `effects`, DRV2605L ROM effect IDs 1-123, played in order |  2-9 |
|   0x20 | `showText`     | u8 `line` (0-3), then 0-18 ASCII chars `text`. Empty clears the line. |  2-20 |
|   0x21 | `showScore`    | u32 `score`, u32 `best` (0 = none), u8 `stars` (0-3)     |    10 |
|   0x22 | `showProgress` | u8 `percent` (0-100), then 0-18 ASCII chars `label`      |  2-20 |
|   0x23 | `clearDisplay` | —                                                        |     1 |
|   0x30 | `syncRequest`  | u32 `afterRecordId`                                      |     5 |
|   0x31 | `syncAck`      | u32 `upToRecordId`                                       |     5 |
|   0x32 | `setBest`      | u8 `modeId`, u32 `score`                                 |     6 |

Display commands only take effect in `app` mode. In `standalone` mode the
firmware ignores them without an error, because the fidget owns its own screen.
`haptic` works in both modes.

## `message` (fidget → app)

The first byte is the message type.

| Type | Name       | Payload after type                                                                 | Bytes |
| ---: | ---------- | ---------------------------------------------------------------------------------- | ----: |
| 0x01 | `record`   | u32 `recordId`, u8 `modeId`, u8 `flags` (`RecordFlag`), u32 `startUnix`, u16 `durationS`, u32 `score`, u16 `actions` | 19 |
| 0x02 | `syncDone` | u32 `newestRecordId` (0 = log empty), u16 `sentCount`                              |     7 |
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
`standaloneModes`.

The app refuses to talk to a fidget whose `protocolVersion` differs from its own,
and tells the user that the app or firmware needs an update.

## Scores in both directions

### Fidget → app (standalone play)

1. The fidget runs its own basic games (`BasicModeId` below) with no phone
   present and scores them on the device.
2. Each finished game is stored in a flash-backed ring log, at least 32 entries.
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
|  1 | `freePlay`  | `fidget-free-play`  | +1 per action: any switch closing, each 1/8 spinner turn, each screw detent, each squeeze. Ends after 20 s idle or 3 min. |
|  2 | `spinCount` | `fidget-spin-count` | 30 s. +10 per full spinner turn, either direction.   |

Ids 1-63 are reserved for firmware basic modes.

## Shared defaults (both sides must match until calibrated per device)

| Name            | Value | Used for                                   |
| --------------- | ----: | ------------------------------------------ |
| `squeezeRawMin` |   200 | Raw value read as "not squeezing" (level 0) |
| `squeezeRawMax` |  3500 | Raw value read as a full squeeze (level 1) |
| `squeezeOnLevel`  | 0.30 | Level that starts a squeeze               |
| `squeezeOffLevel` | 0.15 | Level that ends a squeeze (hysteresis)    |

These are placeholders until the FSR is measured in the built toy.

## DRV2605L effects used by the app

Verified against the TI datasheet effect list (ROM library; use library 6 for the
LRA). `packages/core/src/device/feedback.ts` names them.

| Id | Datasheet name           |
| -: | ------------------------ |
|  1 | Strong Click - 100%      |
|  4 | Sharp Click - 100%       |
|  7 | Soft Bump - 100%         |
| 10 | Double Click - 100%      |
| 12 | Triple Click - 100%      |
| 14 | Strong Buzz - 100%       |
| 24 | Sharp Tick 1 - 100%      |
| 47 | Buzz 1 - 100%            |
