// Reads whatever input hardware board_config.h says is fitted.
#pragma once

#include <stdint.h>

struct RawInputs {
  uint16_t closedSwitches;  // SwitchBit bits, set = closed (not yet debounced)
  uint16_t spinnerRaw;      // AS5600 12-bit angle, 0 if not fitted
  bool spinnerValid;
  int32_t screwDetents;     // cumulative since boot
  uint16_t squeezeRaw;      // 12-bit ADC, 0 if not fitted
};

void inputsBegin();
RawInputs inputsRead();
