// DRV2605L + LRA. Does nothing when JIMMYIT_HAS_HAPTICS is 0.
#pragma once

#include <stdint.h>

bool hapticsBegin();
bool hapticsAvailable();
// Plays up to 8 DRV2605L ROM effect ids in order.
void hapticsPlay(const uint8_t* effects, uint8_t count);

// The app's Feedback.celebrate, for the toy's own celebrations.
constexpr uint8_t kCelebrateEffects[] = {12, 14};
