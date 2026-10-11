#include "haptic_feedback.h"

namespace jimmyit {

bool inputTaps(uint16_t previousStable, uint16_t stable) {
  const uint16_t closed = static_cast<uint16_t>(stable & ~previousStable);
  const uint16_t opened = static_cast<uint16_t>(previousStable & ~stable);
  return (closed & kTapOnCloseBits) != 0 || (opened & kTapOnOpenBits) != 0;
}

void RumbleEnvelope::reset(int32_t spinnerTotal, int32_t screwDetents, uint32_t nowMs) {
  started_ = true;
  spinnerAnchor_ = spinnerTotal;
  screwLast_ = screwDetents;
  windowStartMs_ = nowMs;
  windowTurns_ = 0.0f;
  level_ = 0;
}

uint8_t RumbleEnvelope::update(int32_t spinnerTotal, int32_t screwDetents, uint32_t nowMs) {
  if (!started_) {
    reset(spinnerTotal, screwDetents, nowMs);
    return 0;
  }
  // Wrap-safe differences of the cumulative counters.
  const int32_t spin = static_cast<int32_t>(static_cast<uint32_t>(spinnerTotal) - static_cast<uint32_t>(spinnerAnchor_));
  const int32_t spinAbs = spin < 0 ? -spin : spin;
  if (spinAbs >= kSpinnerDeadbandCounts) {
    windowTurns_ += static_cast<float>(spinAbs) / kSpinnerCountsPerTurn;
    spinnerAnchor_ = spinnerTotal;
  }
  const int32_t screw = static_cast<int32_t>(static_cast<uint32_t>(screwDetents) - static_cast<uint32_t>(screwLast_));
  windowTurns_ += static_cast<float>(screw < 0 ? -screw : screw) / kScrewDetentsPerTurn;
  screwLast_ = screwDetents;

  const uint32_t windowMs = nowMs - windowStartMs_;
  if (windowMs >= kWindowMs) {
    if (windowTurns_ > 0.0f) {
      const float speed = windowTurns_ * 1000.0f / static_cast<float>(windowMs);
      const float fraction = speed >= kFullSpeedTurnsPerS ? 1.0f : speed / kFullSpeedTurnsPerS;
      level_ = static_cast<uint8_t>(kMinAmplitude + fraction * (kMaxAmplitude - kMinAmplitude) + 0.5f);
      lastMotionMs_ = nowMs;
    }
    windowStartMs_ = nowMs;
    windowTurns_ = 0.0f;
  }
  return amplitude(nowMs);
}

uint8_t RumbleEnvelope::amplitude(uint32_t nowMs) const {
  if (level_ == 0) return 0;
  const uint32_t since = nowMs - lastMotionMs_;
  if (since >= kFadeMs) return 0;
  // Full strength until the next window could have refreshed it, then a straight fade to 0.
  if (since <= kWindowMs) return level_;
  return static_cast<uint8_t>(level_ * (kFadeMs - since) / (kFadeMs - kWindowMs));
}

}  // namespace jimmyit
