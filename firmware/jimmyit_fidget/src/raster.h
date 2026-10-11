// Drawing into the OLED's frame buffer itself: 128 × 64, one bit a pixel, laid
// out as the SSD1306 (and Adafruit_SSD1306's getBuffer()) keeps it: byte
// x + (y / 8) * 128, bit y % 8. No Arduino headers, so the boot and result
// animations draw the same pixels on the toy and in host tests and previews.
#pragma once

#include <stddef.h>
#include <stdint.h>

namespace jimmyit {

class Raster {
 public:
  static constexpr int16_t kWidth = 128;
  static constexpr int16_t kHeight = 64;
  static constexpr size_t kBytes = kWidth * kHeight / 8;

  // Draws into `buffer` (kBytes long), which the caller owns.
  explicit Raster(uint8_t* buffer) : buffer_(buffer) {}

  void clear();
  // Everything clips at the screen's edges.
  void pixel(int16_t x, int16_t y, bool on);
  bool get(int16_t x, int16_t y) const;
  void hline(int16_t x, int16_t y, int16_t width, bool on);
  void line(int16_t x0, int16_t y0, int16_t x1, int16_t y1, bool on);
  void circle(int16_t cx, int16_t cy, int16_t r, bool on);  // outline, one pixel thick
  void fillCircle(int16_t cx, int16_t cy, int16_t r, bool on);
  void fillEllipse(int16_t cx, int16_t cy, int16_t rx, int16_t ry, bool on);
  // A rectangle with fully rounded ends (radius = height / 2).
  void fillPill(int16_t x, int16_t y, int16_t width, int16_t height, bool on);
  // A one-bit bitmap (rows top to bottom, MSB = leftmost); only its set pixels are drawn, in `on`.
  void bitmap(int16_t x, int16_t y, const uint8_t* rows, int16_t width, int16_t height, bool on);

 private:
  uint8_t* buffer_;
};

}  // namespace jimmyit
