#include "boot_animation.h"

#include <math.h>

#include "jimmy_face.h"
#include "wordmark_bitmap.h"

namespace jimmyit {

namespace {
constexpr float kPi = 3.14159265f;
constexpr float kRadiansToDegrees = 180.0f / kPi;
// The wordmark is knocked away a little faster than Jimmy pushes it, so it flies off ahead of him.
constexpr float kKnockSpeed = 1.6f;
constexpr float kSmileTiltDeg = 10.0f;
// Rolling away: x = rest - kRollOutAccel * t² (t in seconds), speeding up like the app's roll.
constexpr float kRollOutAccel = 190.0f;
// Every stripe's near end stays level with Jimmy; only the far ends trail. Those lag behind his path (so the
// stripes stretch as he speeds up), the ones level with him least. Lags in ms, lengths in px.
constexpr uint32_t kStripeLagMs[BootAnimation::kStripeCount] = {150, 60, 0, 90, 120};
constexpr int16_t kStripeLength[BootAnimation::kStripeCount] = {70, 96, 120, 88, 76};

float clamp01(float t) { return t < 0.0f ? 0.0f : t > 1.0f ? 1.0f : t; }
float easeOut(float t) {
  const float inverse = 1.0f - t;
  return 1.0f - inverse * inverse * inverse;
}

// Jimmy's x while rolling away, `ms` after he starts; keeps going past the edge so trailing stripes can follow.
float rollOutX(float ms) {
  const float seconds = ms < 0.0f ? 0.0f : ms / 1000.0f;
  return static_cast<float>(BootAnimation::kJimmyRestX) - kRollOutAccel * seconds * seconds;
}
}  // namespace

BootFrame BootAnimation::frame(uint32_t elapsedMs) {
  BootFrame f = {};
  f.wordX = kWordStartX;
  f.jimmyY = kJimmyY;
  f.wordReveal = clamp01((static_cast<float>(elapsedMs) - kWipeStartMs) / static_cast<float>(kWipeMs));

  const int16_t startX = static_cast<int16_t>(Raster::kWidth + kJimmyRadius + 3);
  float x = static_cast<float>(startX);
  if (elapsedMs >= kRollInStartMs && elapsedMs < kRollOutStartMs) {
    const float t = clamp01((static_cast<float>(elapsedMs) - kRollInStartMs) / static_cast<float>(kRollInMs));
    x = static_cast<float>(startX) + static_cast<float>(kJimmyRestX - startX) * easeOut(t);
    const uint32_t smileMs = elapsedMs - kRollInStartMs;
    if (smileMs >= kRollInMs) {
      // Settled in the middle: a happy squint and a little tilt.
      const float p = static_cast<float>(smileMs - kRollInMs) / static_cast<float>(kSmileMs);
      f.squint = true;
      f.rotationDeg = kSmileTiltDeg * sinf(kPi * p);
    }
  } else if (elapsedMs >= kRollOutStartMs) {
    x = rollOutX(static_cast<float>(elapsedMs - kRollOutStartMs));
  }
  f.jimmyX = static_cast<int16_t>(lroundf(x));
  if (!f.squint) f.rotationDeg = (x - kJimmyRestX) / kJimmyRadius * kRadiansToDegrees;  // rolling: upright at rest
  f.showJimmy = elapsedMs >= kRollInStartMs && x - kJimmyRadius - 2 < Raster::kWidth && x + kJimmyRadius + 2 > 0;

  // Rolling in, Jimmy knocks the wordmark off to the left once he reaches it.
  const float wordRight = static_cast<float>(kWordStartX + kWordmarkWidth);
  const float depth = elapsedMs >= kRollOutStartMs ? Raster::kWidth : wordRight + 2.0f - (x - kJimmyRadius);
  if (depth > 0.0f) f.wordX = static_cast<int16_t>(lroundf(kWordStartX - kKnockSpeed * depth));

  // Rolling away, the stripes slide out from behind him, then follow him off the screen.
  if (elapsedMs >= kRollOutStartMs) {
    const float sinceMs = static_cast<float>(elapsedMs - kRollOutStartMs);
    const float grow = clamp01(sinceMs / static_cast<float>(kStripeGrowMs));
    const float left = rollOutX(sinceMs);  // Jimmy's center: the stripes come out from behind him
    for (int i = 0; i < kStripeCount; i++) {
      const float right = rollOutX(sinceMs - static_cast<float>(kStripeLagMs[i])) + kStripeLength[i] * grow;
      f.stripes[i].left = static_cast<int16_t>(lroundf(left));
      f.stripes[i].width = right > 0.0f ? static_cast<int16_t>(lroundf(right - left)) : 0;
    }
  }
  return f;
}

void BootAnimation::draw(Raster& raster, uint32_t elapsedMs) {
  const BootFrame f = frame(elapsedMs);
  raster.clear();
  if (f.wordReveal > 0.0f && f.wordX + kWordmarkWidth > 0) {
    raster.bitmap(f.wordX, kWordY, kWordmarkBitmap, kWordmarkWidth, kWordmarkHeight, true);
    // The wipe: columns past the reveal edge stay dark.
    const int16_t edge = static_cast<int16_t>(f.wordX + lroundf(kWordmarkWidth * f.wordReveal));
    for (int16_t y = kWordY; y < kWordY + kWordmarkHeight; y++) {
      raster.hline(edge, y, static_cast<int16_t>(f.wordX + kWordmarkWidth - edge), false);
    }
  }
  for (int i = 0; i < kStripeCount; i++) {
    if (f.stripes[i].width <= 0) continue;
    const int16_t top = static_cast<int16_t>(i * (kStripeHeight + kStripeGap));
    raster.fillPill(f.stripes[i].left, top, f.stripes[i].width, kStripeHeight, true);
  }
  if (f.showJimmy) drawJimmyFace(raster, f.jimmyX, f.jimmyY, kJimmyRadius, f.rotationDeg, f.squint);
}

}  // namespace jimmyit
