// Reads the LiPo voltage and charge status on the XIAO nRF52840.
#pragma once

#include <stdint.h>

void batteryBegin();
// Call every loop; reads the ADC every few seconds.
void batteryUpdate(uint32_t nowMs);
// 0-100, or 255 (unknown) when no cell is fitted (JIMMYIT_HAS_BATTERY 0).
uint8_t batteryPercent();
// True while USB power is charging the cell.
bool batteryCharging();
