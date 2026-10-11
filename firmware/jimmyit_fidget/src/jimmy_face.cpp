#include "jimmy_face.h"

#include <math.h>

namespace jimmyit {

namespace {
constexpr float kPi = 3.14159265f;
// The reference art is 910 px across, centered on 455; shapes below are in its pixels.
constexpr float kArtCenter = 455.0f;
constexpr float kEyeX[] = {262.0f, 650.0f};
constexpr float kSmile[][2] = {{295, 622}, {330, 665}, {380, 688}, {430, 690}, {480, 678}, {525, 645}, {560, 585}};
constexpr float kTongue[][2] = {{470, 688}, {520, 720}, {590, 740}, {645, 725}, {665, 690}, {640, 640},
                                {600, 610}, {560, 588}};

struct FaceSpace {
  int16_t cx;
  int16_t cy;
  float unit;  // screen pixels per art pixel
  float c;
  float s;
  int16_t x(float artX, float artY) const {
    const float fx = (artX - kArtCenter) * unit;
    const float fy = (artY - kArtCenter) * unit;
    return static_cast<int16_t>(cx + lroundf(fx * c - fy * s));
  }
  int16_t y(float artX, float artY) const {
    const float fx = (artX - kArtCenter) * unit;
    const float fy = (artY - kArtCenter) * unit;
    return static_cast<int16_t>(cy + lroundf(fx * s + fy * c));
  }
};

// A two-pixel-thick black line through art points.
void stroke(Raster& raster, const FaceSpace& face, const float (*points)[2], int count) {
  for (int i = 1; i < count; i++) {
    const int16_t x0 = face.x(points[i - 1][0], points[i - 1][1]);
    const int16_t y0 = face.y(points[i - 1][0], points[i - 1][1]);
    const int16_t x1 = face.x(points[i][0], points[i][1]);
    const int16_t y1 = face.y(points[i][0], points[i][1]);
    raster.line(x0, y0, x1, y1, false);
    raster.line(x0, static_cast<int16_t>(y0 + 1), x1, static_cast<int16_t>(y1 + 1), false);
  }
}
}  // namespace

void drawJimmyFace(Raster& raster, int16_t cx, int16_t cy, int16_t radius, float rotationDeg, bool squint) {
  const float radians = rotationDeg * kPi / 180.0f;
  const FaceSpace face{cx, cy, static_cast<float>(radius) / kArtCenter, cosf(radians), sinf(radians)};

  raster.fillCircle(cx, cy, static_cast<int16_t>(radius + 2), false);
  raster.fillCircle(cx, cy, radius, true);

  const int16_t ringRadius = static_cast<int16_t>(lroundf(122.0f * face.unit));
  const int16_t pupilRx = static_cast<int16_t>(lroundf(95.0f * face.unit));
  const int16_t pupilRy = static_cast<int16_t>(lroundf(110.0f * face.unit));
  for (const float eyeX : kEyeX) {
    if (squint) {
      // Eyes squeezed into a smile: an arch (∩) where the ring was.
      float arch[7][2];
      for (int k = 0; k < 7; k++) {
        const float angle = (195.0f + 150.0f * static_cast<float>(k) / 6.0f) * kPi / 180.0f;
        arch[k][0] = eyeX + 110.0f * cosf(angle);
        arch[k][1] = 440.0f + 110.0f * sinf(angle);
      }
      stroke(raster, face, arch, 7);
      continue;
    }
    raster.circle(face.x(eyeX, 415.0f), face.y(eyeX, 415.0f), ringRadius, false);
    raster.fillEllipse(face.x(eyeX + 31.0f, 415.0f), face.y(eyeX + 31.0f, 415.0f), pupilRx, pupilRy, false);
  }
  stroke(raster, face, kSmile, 7);
  stroke(raster, face, kTongue, 8);
}

}  // namespace jimmyit
