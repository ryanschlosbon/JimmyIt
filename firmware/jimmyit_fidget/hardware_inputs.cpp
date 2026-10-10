#include "hardware_inputs.h"

#include <Arduino.h>
#include <Wire.h>

#include "board_config.h"
#include "src/fidget_protocol.h"
#include "src/input_helpers.h"

#if JIMMYIT_HAS_MCP23017
#include <Adafruit_MCP23X17.h>
#endif

using namespace jimmyit;

namespace {

#if JIMMYIT_HAS_MCP23017
Adafruit_MCP23X17 mcp;
bool mcpOk = false;

// MCP23017 pin (0-7 = GPA0-7, 8-15 = GPB0-7) for each SwitchBit, per the D4 schematic.
struct PinMap {
  uint8_t mcpPin;
  uint8_t switchBit;
};
constexpr PinMap kSwitchPins[] = {
    {0, SwitchBit::kClicker},   {1, SwitchBit::kNavLeft},   {2, SwitchBit::kNavRight},
    {3, SwitchBit::kRocker},    {4, SwitchBit::kScrewHome}, {5, SwitchBit::kScrewOut},
    {8, SwitchBit::kSliderLow}, {9, SwitchBit::kSliderHigh}, {10, SwitchBit::kStylusStowed},
    // GPA6 was the shirt-button flap; it is no longer fitted.
};
#endif

#if JIMMYIT_HAS_AS5600
constexpr uint8_t kAs5600Address = 0x36;
constexpr uint8_t kAs5600RawAngleRegister = 0x0c;
#endif

#if JIMMYIT_HAS_ENCODER
QuadratureDecoder encoder;
void onEncoderEdge() { encoder.onEdge(digitalRead(D6) == HIGH, digitalRead(D7) == HIGH); }
#endif

}  // namespace

void inputsBegin() {
#if JIMMYIT_HAS_BREADBOARD_BUTTON
  pinMode(JIMMYIT_BREADBOARD_BUTTON_PIN, INPUT_PULLUP);  // button pulls the pin to GND when pressed
#endif
#if JIMMYIT_HAS_BREADBOARD_MENU_KEYS
  pinMode(JIMMYIT_BREADBOARD_NAV_LEFT_PIN, INPUT_PULLUP);
  pinMode(JIMMYIT_BREADBOARD_NAV_RIGHT_PIN, INPUT_PULLUP);
#endif
#if JIMMYIT_HAS_MCP23017
  mcpOk = mcp.begin_I2C(0x20, &Wire);
  if (mcpOk) {
    for (const PinMap& p : kSwitchPins) mcp.pinMode(p.mcpPin, INPUT_PULLUP);
  } else {
    Serial.println("MCP23017 not found at 0x20");
  }
#endif
#if JIMMYIT_HAS_ENCODER
  pinMode(D6, INPUT_PULLUP);
  pinMode(D7, INPUT_PULLUP);
  encoder.begin(digitalRead(D6) == HIGH, digitalRead(D7) == HIGH);
  attachInterrupt(digitalPinToInterrupt(D6), onEncoderEdge, CHANGE);
  attachInterrupt(digitalPinToInterrupt(D7), onEncoderEdge, CHANGE);
#endif
}

RawInputs inputsRead() {
  RawInputs in = {};

#if JIMMYIT_HAS_BREADBOARD_BUTTON
  if (digitalRead(JIMMYIT_BREADBOARD_BUTTON_PIN) == LOW) in.closedSwitches |= 1u << SwitchBit::kClicker;
#endif
#if JIMMYIT_HAS_BREADBOARD_MENU_KEYS
  if (digitalRead(JIMMYIT_BREADBOARD_NAV_LEFT_PIN) == LOW) in.closedSwitches |= 1u << SwitchBit::kNavLeft;
  if (digitalRead(JIMMYIT_BREADBOARD_NAV_RIGHT_PIN) == LOW) in.closedSwitches |= 1u << SwitchBit::kNavRight;
#endif

#if JIMMYIT_HAS_MCP23017
  if (mcpOk) {
    const uint16_t levels = mcp.readGPIOAB();  // switches pull to GND: LOW = closed
    for (const PinMap& p : kSwitchPins) {
      if ((levels & (1u << p.mcpPin)) == 0) in.closedSwitches |= 1u << p.switchBit;
    }
  }
#endif

#if JIMMYIT_HAS_AS5600
  Wire.beginTransmission(kAs5600Address);
  Wire.write(kAs5600RawAngleRegister);
  if (Wire.endTransmission(false) == 0 && Wire.requestFrom(kAs5600Address, static_cast<uint8_t>(2)) == 2) {
    const uint16_t high = Wire.read() & 0x0f;
    const uint16_t low = Wire.read();
    uint16_t raw = static_cast<uint16_t>((high << 8) | low);
    if (JIMMYIT_SPINNER_INVERT) raw = static_cast<uint16_t>((4096 - raw) & 0x0fff);
    in.spinnerRaw = raw;
    in.spinnerValid = true;
  }
#endif

#if JIMMYIT_HAS_ENCODER
  in.screwDetents = JIMMYIT_SCREW_INVERT ? -encoder.detents() : encoder.detents();
#endif

  return in;
}

bool inputsHaveMenuKeys() { return JIMMYIT_HAS_MCP23017 || JIMMYIT_HAS_BREADBOARD_MENU_KEYS; }
