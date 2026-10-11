// The toy's result screen after a game, as a timeline: the score sits centered
// with sparkles for a beat, then Jimmy rolls in from the right and pushes it
// aside, tilts with his eyes squeezed into a happy smile, does a little hop and
// throws a few sparkles as he lands, and the screen holds until the toy goes
// back to its ready screen. Pure logic, so the timing is host-tested;
// oled_ui.cpp draws each frame.
#pragma once

#include <stdint.h>

namespace jimmyit {

struct ResultFrame {
  int16_t scoreCenterX;   // the score text is centered on this column
  bool fieldSparkles;     // sparkles across the whole screen (the opening beat)
  bool showJimmy;
  int16_t jimmyX;         // Jimmy's center
  int16_t jimmyY;
  float tiltDeg;          // positive = clockwise
  bool squint;            // eyes squeezed shut in a smile (^ ^)
  bool burst;             // sparkles flying out from Jimmy after he lands
  float burstProgress;    // 0 → 1 while bursting
};

class ResultAnimation {
 public:
  static constexpr int16_t kScreenWidth = 128;
  // Big, so his face has enough pixels to look like him; the score fits in the space he leaves.
  static constexpr int16_t kJimmyRadius = 23;
  static constexpr int16_t kScoreCenterStart = kScreenWidth / 2;
  static constexpr int16_t kScoreCenterEnd = 40;
  static constexpr int16_t kJimmyRestX = 103;
  static constexpr int16_t kJimmyRestY = 32;
  static constexpr int16_t kHopHeight = 7;
  static constexpr float kTiltDeg = 12.0f;

  static constexpr uint32_t kHoldMs = 1000;   // score alone, centered
  static constexpr uint32_t kSlideMs = 700;   // Jimmy rolls in, the score moves aside
  static constexpr uint32_t kTiltMs = 450;    // tips over a little, squinting happily, then back
  static constexpr uint32_t kHopMs = 280;     // then one short hop
  static constexpr uint32_t kBurstMs = 600;   // sparkles from where he lands
  // Then the screen holds until this long after it appeared, and the toy goes back to ready.
  static constexpr uint32_t kTotalMs = 4200;

  static ResultFrame frame(uint32_t elapsedMs);
};

}  // namespace jimmyit
