// What the toy does for each score event (PROTOCOL.md "Score events"): how
// long the animation lasts, which wins when two overlap, and which haptic plays.
// Pure logic; the sketch draws the frames (oled_ui) and drives the DRV2605L.
#pragma once

#include <stdint.h>

#include "fidget_protocol.h"

namespace jimmyit {

struct CelebrationStyle {
  uint16_t durationMs;  // 0 = haptic only (gameEnd shows the result screen instead)
  uint8_t priority;     // a running animation is never replaced by a lower one
  uint8_t effects[2];   // DRV2605L ROM ids, same as the app's Feedback names
  uint8_t effectCount;
  bool fullScreen;      // false = a small overlay on the current screen (points)
};

// `newBestAtEnd` only matters for gameEnd: celebrate instead of success.
CelebrationStyle celebrationStyle(uint8_t kind, bool newBestAtEnd = false);

class Celebration {
 public:
  // Starts an animation unless a higher-priority one is still playing.
  // Returns true if it started (the caller then plays the haptic).
  bool start(uint8_t kind, uint32_t score, uint32_t value, uint32_t nowMs, bool newBestAtEnd = false);
  bool active(uint32_t nowMs) const;
  void cancel() { durationMs_ = 0; }

  uint8_t kind() const { return kind_; }
  uint32_t score() const { return score_; }
  uint32_t value() const { return value_; }
  bool fullScreen() const { return fullScreen_; }
  uint32_t elapsedMs(uint32_t nowMs) const { return nowMs - startMs_; }

 private:
  uint8_t kind_ = 0;
  uint8_t priority_ = 0;
  bool fullScreen_ = false;
  uint32_t score_ = 0;
  uint32_t value_ = 0;
  uint32_t startMs_ = 0;
  uint32_t durationMs_ = 0;
};

}  // namespace jimmyit
