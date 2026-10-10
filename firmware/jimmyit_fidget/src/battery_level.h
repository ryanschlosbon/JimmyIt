// Battery maths for the Adafruit 1317 150 mAh LiPo on the XIAO nRF52840.
// Pure logic; battery_monitor.cpp in the sketch reads the ADC.
#pragma once

#include <stdint.h>

namespace jimmyit {

// XIAO nRF52840: VBAT reaches P0.31 through 1 MΩ (top) and 510 kΩ (bottom).
constexpr uint32_t kVbatDividerTopKohm = 1000;
constexpr uint32_t kVbatDividerBottomKohm = 510;
// ADC: internal 0.6 V reference with 1/6 gain = 3.6 V full scale, 12-bit.
constexpr uint32_t kAdcFullScaleMv = 3600;
constexpr uint32_t kAdcMaxReading = 4095;

// Raw 12-bit ADC reading on the VBAT pin → battery millivolts.
uint32_t batteryMillivoltsFromAdc(uint32_t raw);

// Typical LiPo resting voltage → charge, 0-100. Piecewise linear between
// table points; anything above 4.2 V reads 100, below 3.3 V reads 0.
uint8_t batteryPercentFromMillivolts(uint32_t millivolts);

// Smooths readings so the shown percent doesn't flicker. Only moves the
// displayed value once it differs by 2 % or more, and on first reading.
class BatteryGauge {
 public:
  // Feed one reading; returns the percent to show.
  uint8_t update(uint32_t millivolts);
  uint8_t percent() const { return shown_; }
  bool hasReading() const { return started_; }

 private:
  bool started_ = false;
  uint32_t filteredMv_ = 0;  // exponential average, 1/8 weight per reading
  uint8_t shown_ = 0;
};

}  // namespace jimmyit
