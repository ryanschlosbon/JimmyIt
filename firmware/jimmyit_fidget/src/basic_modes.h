// Games the fidget runs and scores on its own (BasicModeId). This file is the
// authority for their rules; PROTOCOL.md summarizes them. Pure logic: feed it
// the same InputPacket the firmware notifies, plus millis().
#pragma once

#include <stdint.h>

#include "fidget_protocol.h"
#include "score_log.h"

namespace jimmyit {

class BasicGame {
 public:
  static constexpr uint32_t kSpinCountDurationMs = 30000;
  static constexpr uint32_t kSpinCountPointsPerTurn = 10;
  static constexpr uint32_t kFreePlayIdleEndMs = 20000;
  static constexpr uint32_t kFreePlayMaxMs = 180000;
  static constexpr int32_t kFreePlaySpinCountsPerAction = kSpinnerCountsPerTurn / 8;

  // startUnix is real time if clockSet, otherwise seconds since boot.
  bool start(uint8_t modeId, uint32_t nowMs, uint32_t startUnix, bool clockSet);
  void update(const InputPacket& input, uint32_t nowMs);
  // Ends early (child walked away from the menu, power low…): completed = false.
  void cancel(uint32_t nowMs);

  bool isRunning() const { return running_; }
  bool isFinished() const { return finished_; }
  uint8_t modeId() const { return modeId_; }
  uint32_t score() const { return score_; }
  uint16_t actions() const { return actions_; }
  uint32_t remainingMs(uint32_t nowMs) const;

  // The finished game as a log entry (recordId is assigned by ScoreLog::add).
  ScoreEntry result(uint32_t previousBest) const;

 private:
  void finish(uint32_t nowMs, bool completed);
  void addAction(uint32_t count, uint32_t nowMs);

  uint8_t modeId_ = 0;
  bool running_ = false;
  bool finished_ = false;
  bool completed_ = false;
  bool clockSet_ = false;
  bool haveBaseline_ = false;
  uint32_t startMs_ = 0;
  uint32_t endMs_ = 0;
  uint32_t lastActionMs_ = 0;
  uint32_t startUnix_ = 0;
  uint32_t score_ = 0;
  uint16_t actions_ = 0;
  InputPacket previous_ = {};
  int32_t spinAccumulator_ = 0;  // |spinner counts| not yet turned into points
  bool squeezing_ = false;
};

}  // namespace jimmyit
