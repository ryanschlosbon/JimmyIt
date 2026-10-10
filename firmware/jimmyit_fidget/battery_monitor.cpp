#include "battery_monitor.h"

#include <Arduino.h>

#include "board_config.h"
#include "src/battery_level.h"
#include "src/fidget_protocol.h"

namespace {

#if JIMMYIT_HAS_BATTERY
constexpr uint32_t kReadEveryMs = 2000;
// D23 is P0.17, the charger's ~CHG output: LOW while the cell is charging.
constexpr uint8_t kChargeStatusPin = 23;

jimmyit::BatteryGauge gauge;
uint32_t lastReadMs = 0;
bool charging = false;
#endif

}  // namespace

void batteryBegin() {
#if JIMMYIT_HAS_BATTERY
  // Connects the VBAT divider to P0.31. Seeed's warning: never drive this pin
  // HIGH while a cell is attached, or P0.31 sees the full cell voltage.
  pinMode(VBAT_ENABLE, OUTPUT);
  digitalWrite(VBAT_ENABLE, LOW);
#if JIMMYIT_FAST_CHARGE
  pinMode(PIN_CHARGING_CURRENT, OUTPUT);
  digitalWrite(PIN_CHARGING_CURRENT, LOW);  // 100 mA
#endif
  pinMode(kChargeStatusPin, INPUT);
  analogReference(AR_INTERNAL);  // 0.6 V x 6 = 3.6 V full scale, as battery_level.h assumes
  analogReadResolution(12);
  analogSampleTime(40);  // the 1.5 MOhm divider needs a long acquisition time
  lastReadMs = millis() - kReadEveryMs;  // read on the first update
#endif
}

void batteryUpdate(uint32_t nowMs) {
#if JIMMYIT_HAS_BATTERY
  if (nowMs - lastReadMs < kReadEveryMs) return;
  lastReadMs = nowMs;
  charging = digitalRead(kChargeStatusPin) == LOW;
  gauge.update(jimmyit::batteryMillivoltsFromAdc(static_cast<uint32_t>(analogRead(PIN_VBAT))));
#else
  (void)nowMs;
#endif
}

uint8_t batteryPercent() {
#if JIMMYIT_HAS_BATTERY
  return gauge.hasReading() ? gauge.percent() : jimmyit::kBatteryUnknown;
#else
  return jimmyit::kBatteryUnknown;
#endif
}

bool batteryCharging() {
#if JIMMYIT_HAS_BATTERY
  return charging;
#else
  return false;
#endif
}
