// Turning raw hardware readings into the cumulative values the protocol sends.
// Pure logic (no Arduino headers) so it is covered by firmware/test.
#pragma once

#include <stdint.h>

namespace jimmyit {

// Debounces up to 16 switches at once. Bit set = switch closed.
class SwitchDebouncer {
 public:
  explicit SwitchDebouncer(uint32_t settleMs) : settleMs_(settleMs) {}

  // Feeds the raw closed bits read right now. Returns the bits that became
  // (debounced) closed on this call. The first call only sets the baseline.
  uint16_t update(uint16_t rawClosed, uint32_t nowMs);
  uint16_t stable() const { return stable_; }

 private:
  uint32_t settleMs_;
  bool initialized_ = false;
  uint16_t stable_ = 0;
  uint16_t candidate_ = 0;
  uint32_t changedAtMs_[16] = {};
};

// AS5600 gives a 12-bit absolute angle. This keeps a signed running total
// (4096 counts per turn) by taking the shortest way round between readings,
// which holds as long as the spinner turns less than half a turn per reading.
class SpinnerTracker {
 public:
  // Returns the new total. The first reading only sets the baseline.
  int32_t update(uint16_t raw12);
  int32_t total() const { return total_; }

 private:
  bool initialized_ = false;
  uint16_t last_ = 0;
  int32_t total_ = 0;
};

// Quadrature decoder for the captive-screw encoder. Call onEdge() from the
// pin-change interrupt with both pin levels. Counts quarter steps; one detent of
// the PEC11R is a full cycle of 4.
class QuadratureDecoder {
 public:
  void begin(bool a, bool b);
  void onEdge(bool a, bool b);
  int32_t quarterSteps() const { return quarterSteps_; }
  // Whole detents moved since begin(), rounded to the nearest detent.
  int32_t detents() const;

 private:
  volatile uint8_t state_ = 0;
  volatile int32_t quarterSteps_ = 0;
};

}  // namespace jimmyit
