// The toy's boot animation, after the app's intro: the "JimmyIt" wordmark wipes
// in, Jimmy rolls in from the right and knocks it off the screen, smiles, then
// rolls away to the left trailing pill-shaped stripes (the app's coral stripes),
// their near ends level with him, until the screen is clear. A timeline (frame)
// plus its drawing (draw), so the same pixels show on the toy, in host tests and
// in previews.
#pragma once

#include <stdint.h>

#include "raster.h"

namespace jimmyit {

struct BootStripe {
  int16_t left;   // x of the stripe's left end
  int16_t width;  // 0 = not showing
};

struct BootFrame {
  int16_t wordX;         // the wordmark's left edge
  float wordReveal;      // 0 → 1 as it wipes in from the left
  bool showJimmy;
  int16_t jimmyX;
  int16_t jimmyY;
  float rotationDeg;     // rolling, or a happy tilt
  bool squint;
  BootStripe stripes[5];
};

class BootAnimation {
 public:
  static constexpr int16_t kJimmyRadius = 26;  // 52 px across: big enough to keep his face's detail
  static constexpr int16_t kJimmyY = Raster::kHeight / 2;
  static constexpr int16_t kJimmyRestX = Raster::kWidth / 2;
  static constexpr int16_t kWordY = 18;
  static constexpr int16_t kWordStartX = 14;
  static constexpr int kStripeCount = 5;
  static constexpr int16_t kStripeHeight = 12;
  static constexpr int16_t kStripeGap = 1;

  static constexpr uint32_t kWipeStartMs = 150;
  static constexpr uint32_t kWipeMs = 550;
  static constexpr uint32_t kRollInStartMs = 1300;
  static constexpr uint32_t kRollInMs = 1100;
  static constexpr uint32_t kSmileMs = 500;
  static constexpr uint32_t kRollOutStartMs = kRollInStartMs + kRollInMs + kSmileMs;
  static constexpr uint32_t kStripeGrowMs = 300;
  // Everything has left the screen a little before this; then the toy moves on.
  static constexpr uint32_t kTotalMs = 4100;

  static BootFrame frame(uint32_t elapsedMs);
  static void draw(Raster& raster, uint32_t elapsedMs);
};

}  // namespace jimmyit
