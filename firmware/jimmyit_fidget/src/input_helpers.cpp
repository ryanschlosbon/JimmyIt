#include "input_helpers.h"

namespace jimmyit {

uint16_t SwitchDebouncer::update(uint16_t rawClosed, uint32_t nowMs) {
  if (!initialized_) {
    initialized_ = true;
    stable_ = candidate_ = rawClosed;
    return 0;
  }
  uint16_t newlyClosed = 0;
  for (uint8_t bit = 0; bit < 16; bit++) {
    const uint16_t mask = static_cast<uint16_t>(1u << bit);
    if ((rawClosed & mask) != (candidate_ & mask)) {
      candidate_ = static_cast<uint16_t>(candidate_ ^ mask);  // reading changed: restart the settle timer
      changedAtMs_[bit] = nowMs;
    }
    if ((candidate_ & mask) != (stable_ & mask) && nowMs - changedAtMs_[bit] >= settleMs_) {
      stable_ = static_cast<uint16_t>(stable_ ^ mask);
      if (stable_ & mask) newlyClosed = static_cast<uint16_t>(newlyClosed | mask);
    }
  }
  return newlyClosed;
}

int32_t SpinnerTracker::update(uint16_t raw12) {
  raw12 &= 0x0fff;
  if (!initialized_) {
    initialized_ = true;
    last_ = raw12;
    return total_;
  }
  int32_t delta = static_cast<int32_t>(raw12) - static_cast<int32_t>(last_);
  if (delta > 2048) delta -= 4096;
  if (delta < -2048) delta += 4096;
  total_ += delta;
  last_ = raw12;
  return total_;
}

namespace {
// Indexed by (previous state << 2) | new state, state = (a << 1) | b.
// +1 / -1 for a valid quarter step, 0 for no change or an invalid jump.
constexpr int8_t kQuadratureStep[16] = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};
}  // namespace

void QuadratureDecoder::begin(bool a, bool b) {
  state_ = static_cast<uint8_t>((a ? 2 : 0) | (b ? 1 : 0));
  quarterSteps_ = 0;
}

void QuadratureDecoder::onEdge(bool a, bool b) {
  const uint8_t next = static_cast<uint8_t>((a ? 2 : 0) | (b ? 1 : 0));
  quarterSteps_ = quarterSteps_ + kQuadratureStep[(state_ << 2) | next];
  state_ = next;
}

int32_t QuadratureDecoder::detents() const {
  const int32_t q = quarterSteps_;
  return q >= 0 ? (q + 2) / 4 : -((-q + 2) / 4);
}

}  // namespace jimmyit
