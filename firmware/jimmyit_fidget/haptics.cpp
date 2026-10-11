#include "haptics.h"

#include <Arduino.h>

#include "board_config.h"
#include "src/haptic_feedback.h"

#if JIMMYIT_HAS_HAPTICS
#include <Adafruit_DRV2605.h>

namespace {
Adafruit_DRV2605 drv;
bool drvOk = false;
bool realtime = false;         // in RTP mode (rumbling)
uint8_t realtimeValue = 0;     // last amplitude written in RTP mode
bool sequencePlaying = false;  // GO was set and hasn't been seen clear yet
bool sequenceIsTap = false;
uint32_t lastGoCheckMs = 0;
constexpr uint32_t kGoPollMs = 5;  // how often to ask the driver whether a sequence ended

void leaveRealtime() {
  if (!realtime) return;
  drv.setRealtimeValue(0);
  drv.setMode(DRV2605_MODE_INTTRIG);
  realtime = false;
  realtimeValue = 0;
}

void playSequence(const uint8_t* effects, uint8_t count, bool tap) {
  leaveRealtime();
  if (sequencePlaying) drv.stop();
  if (count > 8) count = 8;
  for (uint8_t i = 0; i < count; i++) drv.setWaveform(i, effects[i]);
  if (count < 8) drv.setWaveform(count, 0);  // end of sequence
  drv.go();
  sequencePlaying = true;
  sequenceIsTap = tap;
  lastGoCheckMs = millis();
}
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
  playSequence(effects, count, false);
}

void hapticsTap() {
  if (!drvOk || (sequencePlaying && !sequenceIsTap)) return;
  static const uint8_t kTap[] = {jimmyit::kInputTapEffect};
  playSequence(kTap, 1, true);
}

void hapticsUpdate(uint8_t rumbleAmplitude, uint32_t nowMs) {
  if (!drvOk) return;
  if (sequencePlaying) {
    if (nowMs - lastGoCheckMs < kGoPollMs) return;
    lastGoCheckMs = nowMs;
    if (drv.readRegister8(DRV2605_REG_GO) & 0x01) return;  // still playing
    sequencePlaying = false;
  }
  if (rumbleAmplitude == 0) {
    leaveRealtime();
    return;
  }
  if (rumbleAmplitude == realtimeValue && realtime) return;
  drv.setRealtimeValue(rumbleAmplitude);  // before the mode switch, so it never starts at a stale strength
  realtimeValue = rumbleAmplitude;
  if (!realtime) {
    drv.setMode(DRV2605_MODE_REALTIME);
    realtime = true;
  }
}

#else

bool hapticsBegin() { return false; }
bool hapticsAvailable() { return false; }
void hapticsPlay(const uint8_t*, uint8_t) {}
void hapticsTap() {}
void hapticsUpdate(uint8_t, uint32_t) {}

#endif
