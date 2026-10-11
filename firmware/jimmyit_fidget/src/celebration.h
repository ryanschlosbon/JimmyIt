// What the toy does for each score event (PROTOCOL.md "Score events"): how
// long the animation lasts, which wins when two overlap, and which haptic plays.
// Pure logic; the sketch draws the frames (oled_ui) and drives the DRV2605L.
//
// gameStart and points have no haptic: the toy already gave the move that
// scored its own tap or rumble (haptic_feedback.h), and two pulses would blur.
#pragma once

#include <stdint.h>

#include "fidget_protocol.h"

namespace jimmyit {

struct CelebrationStyle {
  uint16_t durationMs;  // 0 = haptic only (gameEnd shows the result screen instead)
  uint8_t priority;     // a running animation is never replaced by a lower one
  uint8_t effects[3];   // DRV2605L ROM ids played in order (PROTOCOL.md lists them)
  uint8_t effectCount;  // 0 = no haptic
  bool fullScreen;      // false = a small overlay on the current screen (points)
};

// `value` is the event's value: for a milestone, the milestone reached, which
// picks how strong the haptic is. `newBestAtEnd` only matters for gameEnd:
// celebrate instead of success.
CelebrationStyle celebrationStyle(uint8_t kind, uint32_t value = 0, bool newBestAtEnd = false);

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
