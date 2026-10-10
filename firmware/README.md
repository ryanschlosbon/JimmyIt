# Firmware: Seeed XIAO nRF52840

Owner: backend. Protocol: `packages/protocol/PROTOCOL.md`.

The sketch grew out of the KnightHacks breadboard sketch, "Fidget Quest". It
keeps the same screens and the same +10-points-per-press game, and adds:

- Bluetooth, so the app can read every input and send scores, text and haptics back.
- Game sessions that end after 20 s idle (or 3 min). Each one is saved to flash
  and synced to the app later.
- No blocking `delay()` screens, so input is read the whole time.
- A press skips the welcome and instructions screens.

## Files

| Path                                  | What                                                        | Tested |
| ------------------------------------- | ----------------------------------------------------------- | ------ |
| `jimmyit_fidget/jimmyit_fidget.ino`   | `setup()` / `loop()`: screens, standalone game, app commands | compiles (both configs) |
| `jimmyit_fidget/board_config.h`       | **What is wired up.** Flip flags as parts are added         | — |
| `jimmyit_fidget/hardware_inputs.*`    | Reads the button / MCP23017 / AS5600 / encoder / FSR        | compiles |
| `jimmyit_fidget/oled_ui.*`            | Every OLED screen                                           | compiles |
| `jimmyit_fidget/ble_link.*`           | Bluefruit GATT service, advertising, command queue          | compiles |
| `jimmyit_fidget/haptics.*`            | DRV2605L                                                    | compiles |
| `jimmyit_fidget/score_storage.*`      | Saves the score log in internal flash                       | compiles |
| `jimmyit_fidget/src/fidget_protocol.*`| Wire structs, constants, UUIDs, command parser              | host + golden vectors |
| `jimmyit_fidget/src/score_log.*`      | 64-game ring log, bests, flash format                       | host |
| `jimmyit_fidget/src/basic_modes.*`    | The toy's own games (Free Play, Spin Count) and their rules | host |
| `jimmyit_fidget/src/input_helpers.*`  | Debouncer, spinner wrap tracking, encoder decoding          | host |
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

1. Scan and connect to **JimmyIt**. Its service is `59e50001-…`.
2. **Input** (`59e50002-…`): tap the subscribe arrows. Press the button and
   watch the bytes change: byte 0 counts up, and bytes 2-5 show the clicker bit.
3. **Info** (`59e50005-…`): read it. The first byte is `01` (protocol v1).
4. **Command** (`59e50003-…`): write these hex values:
   - `0202`: the app takes over the screen ("CONNECTED TO APP").
   - `200048656c6c6f`: shows "Hello" on line 0.
   - `21780000009600000002`: score screen, 120 points, best 150, 2 stars.
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
| `JIMMYIT_HAS_MCP23017`          | the I/O expander and its switches are wired           |
| `JIMMYIT_HAS_AS5600`            | the spinner sensor and magnet are in                  |
| `JIMMYIT_HAS_ENCODER`           | the captive-screw encoder is on D6/D7                 |
| `JIMMYIT_HAS_FSR`               | the squeeze sensor is on A1                           |
| `JIMMYIT_HAS_HAPTICS`           | the DRV2605L and LRA are wired                        |

`JIMMYIT_SPINNER_INVERT` and `JIMMYIT_SCREW_INVERT` flip a direction if a part
counts the wrong way.

Not done yet: reading the battery level (needs the cell fitted, `VBAT` on
P0.31), the 100 mA charge setting, a menu to choose Spin Count on the toy,
and calibrating the squeeze values.

### Pins and buses (D4 wiring schematic)

| Signal          | XIAO pin | Notes                                    |
| --------------- | -------- | ---------------------------------------- |
| Breadboard button | D0     | to GND, internal pull-up (breadboard only) |
| I2C SDA / SCL   | D4 / D5  | OLED 0x3C, AS5600 0x36, MCP23017 0x20, DRV2605L 0x5A; pull-ups are on the boards |
| Encoder A / B   | D6 / D7  | internal pull-ups, read by interrupt     |
| MCP23017 INTA   | D2       | optional interrupt (not used yet; polled) |
| FSR (squeeze)   | D1 / A1  | 10 kΩ divider + 100 nF                   |
| Charge current  | P0.13 (`PIN_CHARGING_CURRENT`) | drive LOW for 100 mA charging |
| Spare           | D3, D8, D9, D10 | D0 is spare in the final toy      |

MCP23017 inputs (internal pull-ups on): GPA0 clicker, GPA1 nav up, GPA2 nav
down, GPA3 rocker, GPA4 screw home, GPA5 screw out, GPA6 flap contacts, GPB0
slider low, GPB1 slider high, GPB2 stylus stowed. The mapping lives in
`hardware_inputs.cpp`.

DRV2605L: LRA mode, ROM library 6.
