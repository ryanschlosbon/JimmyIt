#include "battery_level.h"

namespace jimmyit {

namespace {
struct CurvePoint {
  uint16_t millivolts;
  uint8_t percent;
};
// Resting LiPo discharge curve (approximate, 3.7 V nominal cell).
constexpr CurvePoint kCurve[] = {
    {4200, 100}, {4100, 90}, {4000, 79}, {3900, 66}, {3800, 52}, {3750, 42},
    {3700, 30},  {3650, 20}, {3600, 12}, {3500, 5},  {3300, 0},
};
constexpr int kCurvePoints = sizeof(kCurve) / sizeof(kCurve[0]);
}  // namespace

uint32_t batteryMillivoltsFromAdc(uint32_t raw) {
  const uint64_t pinMv = static_cast<uint64_t>(raw) * kAdcFullScaleMv / kAdcMaxReading;
  return static_cast<uint32_t>(pinMv * (kVbatDividerTopKohm + kVbatDividerBottomKohm) / kVbatDividerBottomKohm);
}

uint8_t batteryPercentFromMillivolts(uint32_t millivolts) {
  if (millivolts >= kCurve[0].millivolts) return 100;
  for (int i = 1; i < kCurvePoints; i++) {
    const CurvePoint high = kCurve[i - 1];
    const CurvePoint low = kCurve[i];
    if (millivolts >= low.millivolts) {
      const uint32_t span = high.millivolts - low.millivolts;
      return static_cast<uint8_t>(low.percent + (millivolts - low.millivolts) * (high.percent - low.percent) / span);
    }
  }
  return 0;
}

uint8_t BatteryGauge::update(uint32_t millivolts) {
  if (!started_) {
    started_ = true;
    filteredMv_ = millivolts;
    shown_ = batteryPercentFromMillivolts(millivolts);
    return shown_;
  }
  filteredMv_ = (filteredMv_ * 7 + millivolts) / 8;
  const uint8_t next = batteryPercentFromMillivolts(filteredMv_);
  if (next + 2 <= shown_ || next >= shown_ + 2 || next == 0 || next == 100) shown_ = next;
  return shown_;
}

}  // namespace jimmyit
