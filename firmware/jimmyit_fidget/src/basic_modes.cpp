#include "basic_modes.h"

namespace jimmyit {

namespace {

uint32_t popcount16(uint16_t bits) {
  uint32_t n = 0;
  for (; bits; bits &= static_cast<uint16_t>(bits - 1)) n++;
  return n;
}

// Wrap-safe signed difference of two cumulative 32-bit counters.
int32_t wrapDiff32(int32_t now, int32_t before) {
  return static_cast<int32_t>(static_cast<uint32_t>(now) - static_cast<uint32_t>(before));
}

// Wrap-safe signed difference of two cumulative 16-bit counters.
int32_t wrapDiff16(int16_t now, int16_t before) {
  return static_cast<int16_t>(static_cast<uint16_t>(now) - static_cast<uint16_t>(before));
}

}  // namespace

uint32_t SpinSteps::available(int32_t position, int32_t step) const {
  const int32_t diff = wrapDiff32(position, anchor_);
  return static_cast<uint32_t>((diff < 0 ? -diff : diff) / step);
}

uint32_t SpinSteps::take(int32_t position, int32_t step) {
  const uint32_t steps = available(position, step);
  const int32_t moved = static_cast<int32_t>(steps) * step;
  anchor_ = static_cast<int32_t>(static_cast<uint32_t>(anchor_) +
                                 static_cast<uint32_t>(wrapDiff32(position, anchor_) < 0 ? -moved : moved));
  return steps;
}

MoveCount BasicGame::countMoves(const InputPacket& previous, const InputPacket& current) {
  MoveCount moves = {};
  const uint16_t opened = static_cast<uint16_t>(previous.switches & ~current.switches);
  moves.presses = popcount16(current.pressed & kMoveOnCloseBits) + popcount16(opened & kMoveOnOpenBits);
  return moves;
}

bool BasicGame::reset(uint8_t modeId, uint32_t nowMs, uint32_t nowUnix, bool clockSet) {
  if (modeId != BasicModeId::kFreePlay && modeId != BasicModeId::kSpinCount) return false;
  *this = BasicGame();
  modeId_ = modeId;
  armedMs_ = nowMs;
  armedUnix_ = nowUnix;
  clockSet_ = clockSet;
  return true;
}

bool BasicGame::arm(uint8_t modeId, uint32_t nowMs, uint32_t nowUnix, bool clockSet) {
  if (!reset(modeId, nowMs, nowUnix, clockSet)) return false;
  phase_ = Phase::kArmed;
  return true;
}

bool BasicGame::start(uint8_t modeId, uint32_t nowMs, uint32_t nowUnix, bool clockSet) {
  if (!reset(modeId, nowMs, nowUnix, clockSet)) return false;
  begin(nowMs);
  return true;
}

void BasicGame::begin(uint32_t nowMs) {
  phase_ = Phase::kRunning;
  startMs_ = nowMs;
  lastMoveMs_ = nowMs;
  startUnix_ = armedUnix_ + (nowMs - armedMs_) / 1000;
}

void BasicGame::addActions(uint32_t count) {
  const uint32_t room = 0xffffu - actions_;
  actions_ = static_cast<uint16_t>(actions_ + (count < room ? count : room));
}

void BasicGame::update(const InputPacket& input, uint32_t nowMs) {
  if (phase_ != Phase::kArmed && phase_ != Phase::kRunning) return;
  if (!haveBaseline_) {
    previous_ = input;
    haveBaseline_ = true;
    screwPosition_ = 0;
    spinMoves_.reset(input.spinnerTotal);
    screwMoves_.reset(screwPosition_);
    return;
  }
  const uint32_t presses = countMoves(previous_, input).presses;
  screwPosition_ += wrapDiff16(input.screwTotal, previous_.screwTotal);
  previous_ = input;

  if (phase_ == Phase::kArmed) {
    const bool moved = presses > 0 || spinMoves_.available(input.spinnerTotal, kSpinCountsPerMove) > 0 ||
                       screwMoves_.available(screwPosition_, kScrewDetentsPerMove) > 0;
    if (!moved) return;
    begin(nowMs);  // the first move starts the game, and it scores
  }
  const uint32_t quarterTurns = spinMoves_.take(input.spinnerTotal, kSpinCountsPerMove) +
                                screwMoves_.take(screwPosition_, kScrewDetentsPerMove);
  score(presses, quarterTurns, nowMs);
}

void BasicGame::score(uint32_t presses, uint32_t quarterTurns, uint32_t nowMs) {
  // Any move keeps the game going (in Spin Count too, though only turns score there).
  if (presses + quarterTurns > 0) lastMoveMs_ = nowMs;
  if (modeId_ == BasicModeId::kSpinCount) {
    score_ += quarterTurns * kPointsPerQuarterTurn;
    addActions(quarterTurns);
  } else {
    score_ += presses * kPointsPerPress + quarterTurns * kPointsPerQuarterTurn;
    addActions(presses + quarterTurns);
  }
  const uint32_t idleEndMs = lastMoveMs_ + kIdleBeforeGraceMs + kGraceMs;
  const uint32_t maxEndMs = startMs_ + kMaxMs;
  // Ends at whichever comes first, timed exactly rather than at this (possibly late) update.
  if (static_cast<int32_t>(nowMs - idleEndMs) >= 0 || static_cast<int32_t>(nowMs - maxEndMs) >= 0) {
    finish(static_cast<int32_t>(idleEndMs - maxEndMs) < 0 ? idleEndMs : maxEndMs, true);
  }
}

float BasicGame::graceRemaining(uint32_t nowMs) const {
  if (phase_ != Phase::kRunning) return kNotInGrace;
  const uint32_t idle = nowMs - lastMoveMs_;
  if (idle < kIdleBeforeGraceMs) return kNotInGrace;
  if (idle >= kIdleBeforeGraceMs + kGraceMs) return 0.0f;
  return static_cast<float>(kIdleBeforeGraceMs + kGraceMs - idle) / static_cast<float>(kGraceMs);
}

void BasicGame::cancel(uint32_t nowMs) {
  if (phase_ == Phase::kRunning) finish(nowMs, false);
  else if (phase_ == Phase::kArmed) phase_ = Phase::kIdle;
}

void BasicGame::finish(uint32_t nowMs, bool completed) {
  phase_ = Phase::kFinished;
  completed_ = completed;
  endMs_ = nowMs;
}

ScoreEntry BasicGame::result(uint32_t previousBest) const {
  const uint32_t durationS = (endMs_ - startMs_) / 1000;
  ScoreEntry entry = {};
  entry.modeId = modeId_;
  entry.flags = static_cast<uint8_t>((clockSet_ ? RecordFlag::kClockSet : 0) | (completed_ ? RecordFlag::kCompleted : 0) |
                                     (score_ > previousBest ? RecordFlag::kNewBest : 0));
  entry.startUnix = startUnix_;
  entry.durationS = static_cast<uint16_t>(durationS > 0xffff ? 0xffff : durationS);
  entry.score = score_;
  entry.actions = actions_;
  return entry;
}

}  // namespace jimmyit
