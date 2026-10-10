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

int32_t absDiff16(int16_t now, int16_t before) {
  const int16_t delta = static_cast<int16_t>(static_cast<uint16_t>(now) - static_cast<uint16_t>(before));
  return delta < 0 ? -delta : delta;
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
  moves.screw = static_cast<uint32_t>(absDiff16(current.screwTotal, previous.screwTotal));
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
  lastActionMs_ = nowMs;
  startUnix_ = armedUnix_ + (nowMs - armedMs_) / 1000;
}

void BasicGame::addActions(uint32_t count, uint32_t nowMs) {
  if (count == 0) return;
  const uint32_t room = 0xffffu - actions_;
  actions_ = static_cast<uint16_t>(actions_ + (count < room ? count : room));
  lastActionMs_ = nowMs;
}

void BasicGame::update(const InputPacket& input, uint32_t nowMs) {
  if (phase_ != Phase::kArmed && phase_ != Phase::kRunning) return;
  if (!haveBaseline_) {
    previous_ = input;
    haveBaseline_ = true;
    spinMoves_.reset(input.spinnerTotal);
    spinTurns_.reset(input.spinnerTotal);
    return;
  }
  const MoveCount moves = countMoves(previous_, input);
  previous_ = input;

  if (phase_ == Phase::kArmed) {
    const bool moved = moves.presses + moves.screw > 0 ||
                       spinMoves_.available(input.spinnerTotal, kSpinCountsPerMove) > 0;
    if (!moved) return;
    begin(nowMs);  // the first move starts the game, and it scores
  }
  score(moves, nowMs);
}

void BasicGame::score(const MoveCount& moves, uint32_t nowMs) {
  if (modeId_ == BasicModeId::kSpinCount) {
    const uint32_t turns = spinTurns_.take(previous_.spinnerTotal, kSpinnerCountsPerTurn);
    score_ += turns * kSpinCountPointsPerTurn;
    addActions(turns, nowMs);
    if (nowMs - startMs_ >= kSpinCountDurationMs) finish(startMs_ + kSpinCountDurationMs, true);
    return;
  }
  // Free Play: +10 per move of any kind (the original breadboard game's rule).
  const uint32_t spins = spinMoves_.take(previous_.spinnerTotal, kSpinCountsPerMove);
  const uint32_t count = moves.presses + moves.screw + spins;
  score_ += count * kFreePlayPointsPerMove;
  addActions(count, nowMs);
  if (nowMs - lastActionMs_ >= kFreePlayIdleEndMs || nowMs - startMs_ >= kFreePlayMaxMs) finish(nowMs, true);
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

uint32_t BasicGame::remainingMs(uint32_t nowMs) const {
  if (phase_ != Phase::kRunning || modeId_ != BasicModeId::kSpinCount) return 0;
  const uint32_t elapsed = nowMs - startMs_;
  return elapsed >= kSpinCountDurationMs ? 0 : kSpinCountDurationMs - elapsed;
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
