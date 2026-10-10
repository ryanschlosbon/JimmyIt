// Reads whatever input hardware board_config.h says is fitted.
#pragma once

#include <stdint.h>

struct RawInputs {
  uint16_t closedSwitches;  // SwitchBit bits, set = closed (not yet debounced)
  uint16_t spinnerRaw;      // AS5600 12-bit angle, 0 if not fitted
  bool spinnerValid;
  int32_t screwDetents;     // cumulative since boot
};

// True when the toy has left/right menu keys (full toy, or breadboard keys wired).
bool inputsHaveMenuKeys();

void inputsBegin();
RawInputs inputsRead();
