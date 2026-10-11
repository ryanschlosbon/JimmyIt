// The toy's own feedback for the child's hands, played in every mode (on its
// own, in an app game, during the "connect?" question) for the lowest latency:
// a sharp tap when a button closes, and a rumble while the spinner or the
// screw turns. Pure logic; haptics.cpp drives the DRV2605L.
#pragma once

#include <stdint.h>

#include "fidget_protocol.h"

namespace jimmyit {

// DRV2605L ROM effect for a press: Sharp Click - 100%.
constexpr uint8_t kInputTapEffect = 4;

// Switches that tap when they close: the buttons, the slider ends, the rocker
// and the screw's push. Screw limit switches and the stylus bay are positions.
constexpr uint16_t kTapOnCloseBits = (1u << SwitchBit::kClicker) | (1u << SwitchBit::kNavLeft) |
                                     (1u << SwitchBit::kNavRight) | (1u << SwitchBit::kRocker) |
                                     (1u << SwitchBit::kSliderLow) | (1u << SwitchBit::kSliderHigh) |
                                     (1u << SwitchBit::kScrewPush);
// The rocker latches, so flipping it back (opening) taps too.
constexpr uint16_t kTapOnOpenBits = (1u << SwitchBit::kRocker);

// True if going from `previousStable` to `stable` (debounced switch bits) should tap.
bool inputTaps(uint16_t previousStable, uint16_t stable);

// Turns spinner and screw motion into a rumble strength for the DRV2605L's
// real-time playback (RTP) mode: stronger the faster either one turns, and
// fading to nothing kFadeMs after the last motion.
class RumbleEnvelope {
 public:
  // Motion is measured over windows this long, so the strength is steady between readings.
  static constexpr uint32_t kWindowMs = 40;
  // The rumble is gone this long after the last window that saw motion.
  static constexpr uint32_t kFadeMs = 150;
  // AS5600 counts the spinner must move from the last counted spot to count as
  // motion (about 1.4°), so sensor jitter at rest never rumbles.
  static constexpr int32_t kSpinnerDeadbandCounts = 16;
  // RTP amplitudes (signed format: 127 = full drive). Any motion is at least kMinAmplitude
  // so a slow turn is still felt; kFullSpeedTurnsPerS and faster gets kMaxAmplitude.
  static constexpr uint8_t kMinAmplitude = 40;
  static constexpr uint8_t kMaxAmplitude = 127;
  static constexpr float kFullSpeedTurnsPerS = 2.0f;

  // Sets where the spinner and screw are now; the first update() after this measures from here.
  void reset(int32_t spinnerTotal, int32_t screwDetents, uint32_t nowMs);
  // Feeds the cumulative positions (spinner in AS5600 counts, screw in detents)
  // and returns the RTP amplitude to play now, 0 = silent.
  uint8_t update(int32_t spinnerTotal, int32_t screwDetents, uint32_t nowMs);
  uint8_t amplitude(uint32_t nowMs) const;

 private:
  bool started_ = false;
  int32_t spinnerAnchor_ = 0;
  int32_t screwLast_ = 0;
  uint32_t windowStartMs_ = 0;
  float windowTurns_ = 0.0f;
  uint8_t level_ = 0;          // strength measured in the last window that saw motion
  uint32_t lastMotionMs_ = 0;  // end of that window
};

}  // namespace jimmyit
