// DRV2605L + LRA. Does nothing when JIMMYIT_HAS_HAPTICS is 0.
//
// Two kinds of output share the driver: effect sequences from the ROM library
// (input taps, celebrations, the app's `haptic` command) in internal-trigger
// mode, and the spinner/screw rumble in real-time playback (RTP) mode. A
// sequence always wins; the rumble resumes once it has finished.
#pragma once

#include <stdint.h>

bool hapticsBegin();
bool hapticsAvailable();
// Plays up to 8 DRV2605L ROM effect ids in order, replacing whatever is playing.
void hapticsPlay(const uint8_t* effects, uint8_t count);
// The sharp tap for a press. Skipped while a celebration or app sequence is
// still playing, so a quick press never cuts a bigger moment short.
void hapticsTap();
// Call every loop with the rumble strength (RTP amplitude, 0 = none; see
// src/haptic_feedback.h). Switches modes as sequences start and finish.
void hapticsUpdate(uint8_t rumbleAmplitude, uint32_t nowMs);
