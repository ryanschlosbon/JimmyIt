#include "haptics.h"

#include <Arduino.h>

#include "board_config.h"

#if JIMMYIT_HAS_HAPTICS
#include <Adafruit_DRV2605.h>

namespace {
Adafruit_DRV2605 drv;
bool drvOk = false;
}  // namespace

bool hapticsBegin() {
  drvOk = drv.begin();
  if (!drvOk) {
    Serial.println("DRV2605L not found at 0x5A");
    return false;
  }
  drv.useLRA();
  drv.selectLibrary(6);  // LRA library
  drv.setMode(DRV2605_MODE_INTTRIG);
  return true;
}

bool hapticsAvailable() { return drvOk; }

void hapticsPlay(const uint8_t* effects, uint8_t count) {
  if (!drvOk || count == 0) return;
  if (count > 8) count = 8;
  for (uint8_t i = 0; i < count; i++) drv.setWaveform(i, effects[i]);
  if (count < 8) drv.setWaveform(count, 0);  // end of sequence
  drv.go();
}

#else

bool hapticsBegin() { return false; }
bool hapticsAvailable() { return false; }
void hapticsPlay(const uint8_t*, uint8_t) {}

#endif
