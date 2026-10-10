// What is wired up right now. Flip a flag to 1 as each part moves from the
// bag onto the breadboard or into the toy; the rest of the sketch adapts.
#pragma once

#include <stdint.h>

#define JIMMYIT_FIRMWARE_MAJOR 0
#define JIMMYIT_FIRMWARE_MINOR 3
#define JIMMYIT_FIRMWARE_PATCH 0

// Breadboard: one push button from D0 to GND acts as the top clicker.
#define JIMMYIT_HAS_BREADBOARD_BUTTON 1
#define JIMMYIT_BREADBOARD_BUTTON_PIN D0
// Optional breadboard menu keys (button to GND) for the "connect?" prompt and
// the game menu: left = no, right = yes. Set to 1 once wired (D1 and D3 are free).
#define JIMMYIT_HAS_BREADBOARD_MENU_KEYS 0
#define JIMMYIT_BREADBOARD_NAV_LEFT_PIN D1
#define JIMMYIT_BREADBOARD_NAV_RIGHT_PIN D3

// Full toy parts (D4 wiring schematic). All off on the breadboard.
#define JIMMYIT_HAS_MCP23017 0  // every switch, via the I/O expander at 0x20
#define JIMMYIT_HAS_AS5600 0    // spinner angle sensor at 0x36
#define JIMMYIT_HAS_ENCODER 0   // captive-screw encoder on D6 / D7
#define JIMMYIT_HAS_HAPTICS 0   // DRV2605L at 0x5A driving the LRA
// The LiPo cell on the XIAO's BAT pads. Off on a USB-powered breadboard: with
// no cell the VBAT pin reads the charger's voltage, which means nothing.
#define JIMMYIT_HAS_BATTERY 0
// Charge at 100 mA instead of 50 mA (P0.13 low; the D4 power plan's choice for
// the 150 mAh cell, under 1C).
#define JIMMYIT_FAST_CHARGE 1

// Flip if the spinner or screw count the wrong way once assembled.
#define JIMMYIT_SPINNER_INVERT 0
#define JIMMYIT_SCREW_INVERT 0

// Same debounce time as the original breadboard sketch.
constexpr uint32_t kDebounceMs = 50;
