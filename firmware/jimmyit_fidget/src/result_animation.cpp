#include "result_animation.h"

#include <math.h>

namespace jimmyit {

namespace {
constexpr float kPi = 3.14159265f;

// Fast at first, gentle at the end, like something rolling to a stop.
float easeOut(float t) {
  const float inverse = 1.0f - t;
  return 1.0f - inverse * inverse * inverse;
}

int16_t lerp(int16_t from, int16_t to, float t) {
  return static_cast<int16_t>(lroundf(static_cast<float>(from) + static_cast<float>(to - from) * t));
}
}  // namespace

ResultFrame ResultAnimation::frame(uint32_t elapsedMs) {
  ResultFrame f = {};
  f.scoreCenterX = kScoreCenterStart;
  f.jimmyX = kJimmyRestX;
  f.jimmyY = kJimmyRestY;
  if (elapsedMs < kHoldMs) {
    f.fieldSparkles = true;
    return f;
  }

  f.showJimmy = true;
  const uint32_t slideMs = elapsedMs - kHoldMs;
  const int16_t offScreenX = kScreenWidth + kJimmyRadius + 2;
  if (slideMs < kSlideMs) {
    const float t = easeOut(static_cast<float>(slideMs) / static_cast<float>(kSlideMs));
    f.jimmyX = lerp(offScreenX, kJimmyRestX, t);
    f.scoreCenterX = lerp(kScoreCenterStart, kScoreCenterEnd, t);
    return f;
  }
  f.scoreCenterX = kScoreCenterEnd;

  const uint32_t tiltMs = slideMs - kSlideMs;
  if (tiltMs < kTiltMs) {
    f.squint = true;
    f.tiltDeg = kTiltDeg * sinf(kPi * static_cast<float>(tiltMs) / static_cast<float>(kTiltMs));
    return f;
  }

  const uint32_t hopMs = tiltMs - kTiltMs;
  if (hopMs < kHopMs) {
    const float p = static_cast<float>(hopMs) / static_cast<float>(kHopMs);
    f.jimmyY = static_cast<int16_t>(kJimmyRestY - lroundf(kHopHeight * 4.0f * p * (1.0f - p)));
    return f;
  }

  const uint32_t landedMs = hopMs - kHopMs;
  if (landedMs < kBurstMs) {
    f.burst = true;
    f.burstProgress = static_cast<float>(landedMs) / static_cast<float>(kBurstMs);
  }
  return f;
}

}  // namespace jimmyit
