#include "raster.h"

#include <math.h>
#include <string.h>

namespace jimmyit {

void Raster::clear() { memset(buffer_, 0, kBytes); }

void Raster::pixel(int16_t x, int16_t y, bool on) {
  if (x < 0 || y < 0 || x >= kWidth || y >= kHeight) return;
  uint8_t& byte = buffer_[x + (y / 8) * kWidth];
  const uint8_t bit = static_cast<uint8_t>(1u << (y & 7));
  byte = on ? static_cast<uint8_t>(byte | bit) : static_cast<uint8_t>(byte & ~bit);
}

bool Raster::get(int16_t x, int16_t y) const {
  if (x < 0 || y < 0 || x >= kWidth || y >= kHeight) return false;
  return (buffer_[x + (y / 8) * kWidth] & (1u << (y & 7))) != 0;
}

void Raster::hline(int16_t x, int16_t y, int16_t width, bool on) {
  if (y < 0 || y >= kHeight || width <= 0) return;
  int16_t from = x < 0 ? 0 : x;
  const int32_t end = static_cast<int32_t>(x) + width;
  const int16_t to = end > kWidth ? kWidth : static_cast<int16_t>(end);
  for (; from < to; from++) pixel(from, y, on);
}

void Raster::line(int16_t x0, int16_t y0, int16_t x1, int16_t y1, bool on) {
  // Bresenham.
  const int16_t dx = static_cast<int16_t>(x1 > x0 ? x1 - x0 : x0 - x1);
  const int16_t dy = static_cast<int16_t>(y1 > y0 ? y0 - y1 : y1 - y0);
  const int16_t sx = x0 < x1 ? 1 : -1;
  const int16_t sy = y0 < y1 ? 1 : -1;
  int32_t error = dx + dy;
  for (;;) {
    pixel(x0, y0, on);
    if (x0 == x1 && y0 == y1) return;
    const int32_t twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x0 = static_cast<int16_t>(x0 + sx);
    }
    if (twice <= dx) {
      error += dx;
      y0 = static_cast<int16_t>(y0 + sy);
    }
  }
}

void Raster::circle(int16_t cx, int16_t cy, int16_t r, bool on) {
  // Midpoint circle.
  int16_t x = r;
  int16_t y = 0;
  int16_t error = static_cast<int16_t>(1 - r);
  while (x >= y) {
    pixel(cx + x, cy + y, on);
    pixel(cx + y, cy + x, on);
    pixel(cx - y, cy + x, on);
    pixel(cx - x, cy + y, on);
    pixel(cx - x, cy - y, on);
    pixel(cx - y, cy - x, on);
    pixel(cx + y, cy - x, on);
    pixel(cx + x, cy - y, on);
    y++;
    if (error < 0) {
      error = static_cast<int16_t>(error + 2 * y + 1);
    } else {
      x--;
      error = static_cast<int16_t>(error + 2 * (y - x) + 1);
    }
  }
}

void Raster::fillCircle(int16_t cx, int16_t cy, int16_t r, bool on) { fillEllipse(cx, cy, r, r, on); }

void Raster::fillEllipse(int16_t cx, int16_t cy, int16_t rx, int16_t ry, bool on) {
  if (rx < 0 || ry < 0) return;
  for (int16_t dy = static_cast<int16_t>(-ry); dy <= ry; dy++) {
    const float t = ry == 0 ? 0.0f : static_cast<float>(dy) / static_cast<float>(ry);
    const int16_t half = static_cast<int16_t>(lroundf(static_cast<float>(rx) * sqrtf(1.0f - t * t)));
    hline(static_cast<int16_t>(cx - half), static_cast<int16_t>(cy + dy), static_cast<int16_t>(half * 2 + 1), on);
  }
}

void Raster::fillPill(int16_t x, int16_t y, int16_t width, int16_t height, bool on) {
  if (width <= 0 || height <= 0) return;
  const float r = static_cast<float>(height) / 2.0f;
  for (int16_t row = 0; row < height; row++) {
    // How far this row's ends are inset by the rounding.
    const float fromCenter = (static_cast<float>(row) + 0.5f) - r;
    const float inset = r - sqrtf(r * r - fromCenter * fromCenter);
    const int16_t trim = static_cast<int16_t>(lroundf(inset));
    const int16_t rowWidth = static_cast<int16_t>(width - 2 * trim);
    hline(static_cast<int16_t>(x + trim), static_cast<int16_t>(y + row), rowWidth, on);
  }
}

void Raster::bitmap(int16_t x, int16_t y, const uint8_t* rows, int16_t width, int16_t height, bool on) {
  const int16_t rowBytes = static_cast<int16_t>((width + 7) / 8);
  for (int16_t row = 0; row < height; row++) {
    for (int16_t column = 0; column < width; column++) {
      if (rows[row * rowBytes + column / 8] & (0x80u >> (column & 7))) {
        pixel(static_cast<int16_t>(x + column), static_cast<int16_t>(y + row), on);
      }
    }
  }
}

}  // namespace jimmyit
