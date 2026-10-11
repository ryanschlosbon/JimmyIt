# Firmware: Seeed XIAO nRF52840

Owner: backend. Protocol: `packages/protocol/PROTOCOL.md`.

The sketch grew out of the KnightHacks breadboard sketch, "Fidget Quest". It
keeps the same screens and the same +10 points per move, and adds Bluetooth,
flash storage and game sessions.

## How the toy plays without the app

```
power on → WELCOME (5 s) → INSTRUCTIONS (10 s) → READY ──first move──► PLAYING ──20 s with no move──► RESULT (4 s) ─┐
           (a press skips either)                ▲  "MAKE A MOVE TO START!"   +10 per move,                    │
                                                 │                            AMAZING JOB! every 100           │
                                                 └─────────────────────────────────────────────────────────────┘
```

- **Free Play is the default game.** On READY it waits; the child's first move
  (press, flip, slide, 90° spin, screw detent, stylus out) starts the
  game *and* scores. It ends when the child takes too long for the next move
  (`BasicGame::kFreePlayIdleEndMs`, 20 s) or after 3 minutes.
- **Every finished game is saved to flash** (up to 200; the oldest is replaced
  when full), with a real timestamp if the app has set the clock since power-on.
- **When the app connects, it uploads every game it hasn't seen yet.** The toy
  keeps playing Free Play while connected, and those games reach the app as they
  finish. Starting a game in the app ends a toy game in progress (it is saved)
  and hands the screen to the app. When the app game ends, the toy shows its score
  on the result screen, then Free Play is ready again.
- On the full toy, **the left/right menu keys on READY pick Spin Count** (30 s,
  +10 per full spinner turn). It appears only when `JIMMYIT_HAS_AS5600` is on.
- Input is read the whole time: no blocking `delay()` screens.

## Score moments: animations and haptics

The same five moments play out on the toy whether the toy or the app is
running the game (PROTOCOL.md "Score events"):

| Moment | Toy screen | Haptic |
| --- | --- | --- |
| Game starts | "GO!" with rays bursting out | soft bump |
| Points | "+10" floats up in the corner | tick |
| Every 100 points | sparkles + "AMAZING JOB! 200 POINTS!" | double click |
| Passing the old high score | flashing "NEW HIGH SCORE!" box with rippling rings | triple click + buzz |
| Game ends | result screen ("NEW BEST!" if it was) | double click, or celebrate for a best |

A bigger animation is never cut short by a smaller one. During a toy game,
the toy also sends each moment to a connected app so the app can celebrate
too; during an app game, the app sends them to the toy. Timing and priorities
live in `src/celebration.cpp`, the drawing in `oled_ui.cpp`.

## Connecting: the child says yes

When a phone or tablet connects, the toy asks **"CONNECT TO <NAME>?"**:
**left menu key = no, right = yes** (no answer in 30 s = no). On a breadboard
without menu keys, the clicker means yes. A phone the child said yes to is
remembered in flash (up to 8), so it isn't asked about again. Holding both
menu keys for 5 s on READY forgets every phone. Until the child says yes, the
phone gets no input and its commands are refused.

## Battery

With `JIMMYIT_HAS_BATTERY 1`, the toy reads the cell every 2 s (VBAT through
the XIAO's 1 MΩ / 510 kΩ divider on P0.31), smooths it, and reports 0-100 % in
every input packet, plus whether USB is charging it (P0.17). The percent is
from a typical LiPo curve, so it's approximate, and reads high while
charging. `JIMMYIT_FAST_CHARGE 1` charges at 100 mA (P0.13 low). Keep
`JIMMYIT_HAS_BATTERY 0` on a USB-powered breadboard: with no cell the reading
means nothing.

### Memory

The nRF52840 has 256 KB of RAM and 1 MB of flash (not 16 KB). This sketch
uses about 29 KB of RAM (12%) and 150-157 KB of flash (18-19%). The score log takes about
4.8 KB of RAM and a 4 KB file in flash, and RAM is not where scores live:
they're written to flash after every game, so turning the toy off loses nothing.

## Files

| Path                                  | What                                                        | Tested |
| ------------------------------------- | ----------------------------------------------------------- | ------ |
| `jimmyit_fidget/jimmyit_fidget.ino`   | `setup()` / `loop()`: screens, standalone game, app commands | compiles (both configs) |
| `jimmyit_fidget/board_config.h`       | **What is wired up.** Flip flags as parts are added         | — |
| `jimmyit_fidget/hardware_inputs.*`    | Reads the button / menu keys / MCP23017 / AS5600 / encoder  | compiles |
| `jimmyit_fidget/oled_ui.*`            | Every OLED screen, the "connect?" question, celebration animations | compiles |
| `jimmyit_fidget/ble_link.*`           | Bluefruit GATT service, advertising, command queue          | compiles |
| `jimmyit_fidget/haptics.*`            | DRV2605L                                                    | compiles |
| `jimmyit_fidget/battery_monitor.*`    | Reads VBAT and the charge pin                               | compiles |
| `jimmyit_fidget/score_storage.*`      | Saves the score log and approved phones in internal flash   | compiles |
| `jimmyit_fidget/src/fidget_protocol.*`| Wire structs, constants, UUIDs, command parser              | host + golden vectors |
| `jimmyit_fidget/src/score_log.*`      | 200-game ring log, bests, flash format                      | host |
| `jimmyit_fidget/src/basic_modes.*`    | The toy's own games (Free Play, Spin Count), first-move start, move counting | host |
| `jimmyit_fidget/src/input_helpers.*`  | Debouncer, spinner wrap tracking, encoder decoding          | host |
| `jimmyit_fidget/src/score_events.*`   | When score moments happen (same rules as the app)           | host |
| `jimmyit_fidget/src/celebration.*`    | Animation length, priority and haptic for each moment       | host |
| `jimmyit_fidget/src/connection_approval.*` | The "connect?" question, timeouts, remembered phones   | host |
| `jimmyit_fidget/src/battery_level.*`  | ADC → millivolts → percent, smoothing                       | host |
| `test/`                               | Host test runner; `gen_vectors.py` turns the golden vectors into C++ checks | — |

Everything in `src/` has no Arduino headers and is tested on a laptop:

```bash
npm run test:firmware
```

## Flashing

1. Arduino IDE → Tools → Board → **Seeed nRF52 Boards → Seeed XIAO nRF52840**,
   not the "mbed-enabled" one.
2. Libraries (Library Manager): **Adafruit SSD1306** and **Adafruit GFX**. When
   those parts are fitted, also **Adafruit MCP23017 Arduino Library** and
   **Adafruit DRV2605 Library**. Bluetooth and flash storage come with the board
   package.
3. Open `firmware/jimmyit_fidget/jimmyit_fidget.ino` and click Upload. If
   upload fails, double-tap the XIAO's reset button and try again.

From the command line, the same build:

```bash
arduino-cli compile --fqbn Seeeduino:nrf52:xiaonRF52840 firmware/jimmyit_fidget
```

If the build ends with `exec: "python": executable file not found`, the board
package wants `python` and macOS only has `python3`. Run
`ln -s "$(which python3)" /usr/local/bin/python` once, or use the Arduino IDE.

## Testing Bluetooth without our app

Install **nRF Connect for Mobile** (Nordic, free) on an Android phone.

1. Scan and connect to **JimmyIt**. Its service is `59e50001-…`. After 2 s the
   toy asks "CONNECT TO A PHONE?": press yes on the toy (right menu key, or
   the clicker on the breadboard). Until then commands get error `05`.
2. **Input** (`59e50002-…`): tap the subscribe arrows. Press the button and
   watch the bytes change: byte 0 counts up, and bytes 2-5 show the clicker bit.
3. **Info** (`59e50005-…`): read it. The first byte is `01` (protocol v1).
4. **Command** (`59e50003-…`): write these hex values:
   - `0202`: the app takes over the screen ("CONNECTED TO APP").
   - `200048656c6c6f`: shows "Hello" on line 0.
   - `21780000009600000002`: score screen, 120 points, best 150, 2 stars.
   - `240404010000fa000000`: plays the "NEW HIGH SCORE!" animation (260, beat 250).
   - `0201`: hands the screen back to the toy.
5. **Message** (`59e50004-…`): subscribe, then write `3000000000` (sync from
   record 0) to the command characteristic. You get one record per finished
   game, then `02…` (sync done).

The Serial Monitor (115200 baud) logs connects, presses, points and game ends.

## Moving from breadboard to the toy

Edit `board_config.h`:

| Flag                            | Turn on when                                          |
| ------------------------------- | ----------------------------------------------------- |
| `JIMMYIT_HAS_BREADBOARD_BUTTON` | set to **0** once the MCP23017 carries the clicker     |
| `JIMMYIT_HAS_BREADBOARD_MENU_KEYS` | two buttons to GND on D1 (left/no) and D3 (right/yes) |
| `JIMMYIT_HAS_MCP23017`          | the I/O expander and its switches are wired           |
| `JIMMYIT_HAS_AS5600`            | the spinner sensor and magnet are in                  |
| `JIMMYIT_HAS_ENCODER`           | the captive-screw encoder is on D6/D7                 |
| `JIMMYIT_HAS_HAPTICS`           | the DRV2605L and LRA are wired                        |
| `JIMMYIT_HAS_BATTERY`           | the LiPo is on the BAT pads                           |

`JIMMYIT_SPINNER_INVERT` and `JIMMYIT_SCREW_INVERT` flip a direction if a part
counts the wrong way.

The squeeze sensor and the shirt-button flap are no longer part of the toy;
their protocol bits are reserved and always 0.

Upgrading from the first breadboard firmware resets the saved score log once
(its flash format changed when capacity went from 64 to 200). The app copes:
it sees the toy's record ids restart and syncs from the beginning.

### Pins and buses (D4 wiring schematic)

| Signal          | XIAO pin | Notes                                    |
| --------------- | -------- | ---------------------------------------- |
| Breadboard button | D0     | to GND, internal pull-up (breadboard only) |
| I2C SDA / SCL   | D4 / D5  | OLED 0x3C, AS5600 0x36, MCP23017 0x20, DRV2605L 0x5A; pull-ups are on the boards |
| Encoder A / B   | D6 / D7  | internal pull-ups, read by interrupt     |
| MCP23017 INTA   | D2       | optional interrupt (not used yet; polled) |
| Breadboard menu keys | D1 (left), D3 (right) | to GND, internal pull-ups (breadboard only) |
| Battery voltage | P0.31 (`PIN_VBAT`), enabled by P0.14 (`VBAT_ENABLE`) LOW | never drive P0.14 HIGH |
| Charge status   | P0.17 (D23) | LOW while charging                    |
| Charge current  | P0.13 (`PIN_CHARGING_CURRENT`) | drive LOW for 100 mA charging |
| Spare           | D1, D3, D8, D9, D10 | D0 is spare in the final toy  |

MCP23017 inputs (internal pull-ups on): GPA0 clicker, GPA1 menu left (no),
GPA2 menu right (yes), GPA3 rocker, GPA4 screw home, GPA5 screw out, GPB0
slider low, GPB1 slider high, GPB2 stylus stowed. GPA6 (was the flap) is
unused. The mapping lives in `hardware_inputs.cpp`; swap GPA1/GPA2 there if
the keys end up the other way round.

DRV2605L: LRA mode, ROM library 6.
