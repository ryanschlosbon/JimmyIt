// Games the fidget runs and scores on its own (BasicModeId). This file is the
// authority for their rules; PROTOCOL.md summarizes them. Pure logic: feed it
// the same InputPacket the firmware notifies, plus millis().
#pragma once

#include <stdint.h>

#include "fidget_protocol.h"
#include "score_log.h"

namespace jimmyit {

// Moves made between two input packets, counted the same way as the app's
// createToyActionTracker (packages/core/src/input/toy-actions.ts).
struct MoveCount {
  uint32_t presses;  // clicker, menu keys, rocker flips, slider ends, stylus taken out
  uint32_t screw;    // detents, either direction
};

// Counts spinner moves of `step` counts in either direction. Measures from the
// last counted position, so sensor jitter around one spot never adds up to a move.
class SpinSteps {
 public:
  void reset(int32_t position) { anchor_ = position; }
  // Whole steps between the anchor and `position`; does not consume them.
  uint32_t available(int32_t position, int32_t step) const;
  // Returns and consumes whole steps, moving the anchor toward `position`.
  uint32_t take(int32_t position, int32_t step);

 private:
  int32_t anchor_ = 0;
};

// Bits of `pressed` that are a move when they close. Screw limit switches and the
// stylus going back in are positions, not moves.
constexpr uint16_t kMoveOnCloseBits = (1u << SwitchBit::kClicker) | (1u << SwitchBit::kNavLeft) |
                                      (1u << SwitchBit::kNavRight) | (1u << SwitchBit::kRocker) |
                                      (1u << SwitchBit::kSliderLow) | (1u << SwitchBit::kSliderHigh);
// Bits that are a move when they open: the rocker latches (both ways count), and
// opening the stylus switch means the stylus was taken out.
constexpr uint16_t kMoveOnOpenBits = (1u << SwitchBit::kRocker) | (1u << SwitchBit::kStylusStowed);

class BasicGame {
 public:
  static constexpr int32_t kSpinCountsPerMove = kSpinnerCountsPerTurn / 4;  // a 90° spin, as in the app
  static constexpr uint32_t kSpinCountDurationMs = 30000;
  static constexpr uint32_t kSpinCountPointsPerTurn = 10;
  static constexpr uint32_t kFreePlayPointsPerMove = 10;
  // "Takes too long for the next move": Free Play ends this long after the last move.
  static constexpr uint32_t kFreePlayIdleEndMs = 20000;
  static constexpr uint32_t kFreePlayMaxMs = 180000;

  // Waits for the child's first move, then starts the clock and scores that move.
  // nowUnix is real time if clockSet, otherwise seconds since boot.
  bool arm(uint8_t modeId, uint32_t nowMs, uint32_t nowUnix, bool clockSet);
  // Starts the clock immediately; the next update() only sets the baseline.
  bool start(uint8_t modeId, uint32_t nowMs, uint32_t nowUnix, bool clockSet);
  void update(const InputPacket& input, uint32_t nowMs);
  // Ends early (the app took over, power low…): completed = false. Disarms an armed game.
  void cancel(uint32_t nowMs);

  bool isArmed() const { return phase_ == Phase::kArmed; }
  bool isRunning() const { return phase_ == Phase::kRunning; }
  bool isFinished() const { return phase_ == Phase::kFinished; }
  uint8_t modeId() const { return modeId_; }
  uint32_t score() const { return score_; }
  uint16_t actions() const { return actions_; }
  uint32_t remainingMs(uint32_t nowMs) const;

  // The finished game as a log entry (recordId is assigned by ScoreLog::add).
  ScoreEntry result(uint32_t previousBest) const;

  // Presses and screw detents between two packets (spins are counted
  // separately with SpinSteps). Exposed for tests and for the sketch's menus.
  static MoveCount countMoves(const InputPacket& previous, const InputPacket& current);

 private:
  enum class Phase : uint8_t { kIdle, kArmed, kRunning, kFinished };

  bool reset(uint8_t modeId, uint32_t nowMs, uint32_t nowUnix, bool clockSet);
  void begin(uint32_t nowMs);
  void score(const MoveCount& moves, uint32_t nowMs);
  void finish(uint32_t nowMs, bool completed);
  void addActions(uint32_t count, uint32_t nowMs);

  Phase phase_ = Phase::kIdle;
  uint8_t modeId_ = 0;
  bool completed_ = false;
  bool clockSet_ = false;
  bool haveBaseline_ = false;
  uint32_t armedMs_ = 0;
  uint32_t armedUnix_ = 0;
  uint32_t startMs_ = 0;
  uint32_t endMs_ = 0;
  uint32_t lastActionMs_ = 0;
  uint32_t startUnix_ = 0;
  uint32_t score_ = 0;
  uint16_t actions_ = 0;
  InputPacket previous_ = {};
  SpinSteps spinMoves_;  // quarter turns, for Free Play moves and for arming
  SpinSteps spinTurns_;  // full turns, for Spin Count
};

}  // namespace jimmyit
