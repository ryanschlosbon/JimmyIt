# Firmware: Seeed XIAO nRF52840

Owner: backend. Protocol: `packages/protocol/PROTOCOL.md`.

## What is here

| Path                                   | What                                                      | Tested |
| -------------------------------------- | --------------------------------------------------------- | ------ |
| `jimmyit_fidget/src/fidget_protocol.*` | Wire structs, constants, UUID helper, command parser       | yes, host + golden vectors |
| `jimmyit_fidget/src/score_log.*`       | 64-entry ring log of standalone games, bests, flash format | yes, host |
| `jimmyit_fidget/src/basic_modes.*`     | The toy's own games (Free Play, Spin Count) and their scoring | yes, host |
| `test/`                                | Host test runner; `gen_vectors.py` turns the golden vectors into C++ checks | — |

These modules include no Arduino headers, so they compile and run on a laptop:

```bash
npm run test:firmware
```

That command is `make -C firmware/test`, which needs `c++`, `make` and
`python3`.

## Not written yet: the sketch `jimmyit_fidget/jimmyit_fidget.ino`

The Arduino IDE compiles `jimmyit_fidget/src/` together with the sketch. The
sketch's job:

1. **BLE** (Adafruit Bluefruit nRF52 library): one service with `input`
   (read, notify), `command` (write, write without response), `message`
   (notify) and `info` (read). Build UUIDs with `makeUuid128()`. Advertise the
   service UUID; put the name `JimmyIt` in the scan response.
2. **Input loop:** read the MCP23017 (switches, with interrupt on D2), the
   encoder on D6/D7, the AS5600 angle (I2C 0x36) and the FSR on A1. Keep the
   cumulative counters and the `pressed` latch. Notify `input` on change, at
   most 50 Hz, and at least once a second.
3. **Commands:** `parseCommand()` → act; on error, notify
   `makeErrorMessage()`. Display commands only apply in app mode. Handle
   `syncRequest` by sending `toRecordMessage()` for each
   `ScoreLog::collectAfter()` entry, then a `SyncDoneMessage`.
4. **Standalone mode:** OLED menu (nav up/down + clicker) → `BasicGame`. On
   finish: `ScoreLog::add(game.result(log.best(mode)))`, `raiseBest`, save the
   log to InternalFS, notify the record if connected.
5. **Disconnect** → back to standalone mode.

### Pins and buses (D4 wiring schematic)

| Signal          | XIAO pin | Notes                                    |
| --------------- | -------- | ---------------------------------------- |
| I2C SDA / SCL   | D4 / D5  | OLED 0x3C, AS5600 0x36, MCP23017 0x20, DRV2605L 0x5A; pull-ups are on the boards |
| Encoder A / B   | D6 / D7  | internal pull-ups                        |
| MCP23017 INTA   | D2       | optional interrupt                       |
| FSR (squeeze)   | D1 / A1  | 10 kΩ divider + 100 nF                   |
| Charge current  | P0.13    | drive LOW for 100 mA charging            |
| Spare           | D0, D3, D8, D9, D10 |                               |

MCP23017 inputs (internal pull-ups on): GPA0 clicker, GPA1 nav up, GPA2 nav
down, GPA3 rocker, GPA4 screw home, GPA5 screw out, GPA6 flap contacts, GPB0
slider low, GPB1 slider high, GPB2 stylus stowed. Map these to `SwitchBit`.

DRV2605L: LRA mode, ROM library 6.
