#include "basic_modes.h"

namespace jimmyit {

namespace {

uint32_t popcount16(uint16_t bits) {
  uint32_t n = 0;
  for (; bits; bits &= static_cast<uint16_t>(bits - 1)) n++;
  return n;
}

int32_t absDiff32(int32_t now, int32_t before) {
  const int32_t delta = static_cast<int32_t>(static_cast<uint32_t>(now) - static_cast<uint32_t>(before));
  return delta < 0 ? -delta : delta;
}

int32_t absDiff16(int16_t now, int16_t before) {
  const int16_t delta = static_cast<int16_t>(static_cast<uint16_t>(now) - static_cast<uint16_t>(before));
  return delta < 0 ? -delta : delta;
}

}  // namespace

bool BasicGame::start(uint8_t modeId, uint32_t nowMs, uint32_t startUnix, bool clockSet) {
  if (modeId != BasicModeId::kFreePlay && modeId != BasicModeId::kSpinCount) return false;
  *this = BasicGame();
  modeId_ = modeId;
  running_ = true;
  startMs_ = nowMs;
  lastActionMs_ = nowMs;
  startUnix_ = startUnix;
  clockSet_ = clockSet;
  return true;
}

void BasicGame::addAction(uint32_t count, uint32_t nowMs) {
  if (count == 0) return;
  const uint32_t room = 0xffffu - actions_;
  actions_ = static_cast<uint16_t>(actions_ + (count < room ? count : room));
  lastActionMs_ = nowMs;
}

void BasicGame::update(const InputPacket& input, uint32_t nowMs) {
  if (!running_) return;
  if (!haveBaseline_) {
    previous_ = input;
    haveBaseline_ = true;
    squeezing_ = input.squeezeRaw >= kSqueezeRawOn;
    return;
  }

  spinAccumulator_ += absDiff32(input.spinnerTotal, previous_.spinnerTotal);

  if (modeId_ == BasicModeId::kSpinCount) {
    const uint32_t turns = static_cast<uint32_t>(spinAccumulator_ / kSpinnerCountsPerTurn);
    spinAccumulator_ %= kSpinnerCountsPerTurn;
    score_ += turns * kSpinCountPointsPerTurn;
    addAction(turns, nowMs);
    if (nowMs - startMs_ >= kSpinCountDurationMs) finish(startMs_ + kSpinCountDurationMs, true);
  } else {  // kFreePlay: +10 per action of any kind (the original breadboard game's rule)
    uint32_t count = popcount16(input.pressed);
    count += static_cast<uint32_t>(spinAccumulator_ / kFreePlaySpinCountsPerAction);
    spinAccumulator_ %= kFreePlaySpinCountsPerAction;
    count += static_cast<uint32_t>(absDiff16(input.screwTotal, previous_.screwTotal));
    if (!squeezing_ && input.squeezeRaw >= kSqueezeRawOn) {
      squeezing_ = true;
      count++;
    } else if (squeezing_ && input.squeezeRaw <= kSqueezeRawOff) {
      squeezing_ = false;
    }
    score_ += count * kFreePlayPointsPerAction;
    addAction(count, nowMs);
    if (nowMs - lastActionMs_ >= kFreePlayIdleEndMs || nowMs - startMs_ >= kFreePlayMaxMs) finish(nowMs, true);
  }
  previous_ = input;
}

void BasicGame::cancel(uint32_t nowMs) {
  if (running_) finish(nowMs, false);
}

void BasicGame::finish(uint32_t nowMs, bool completed) {
  running_ = false;
  finished_ = true;
  completed_ = completed;
  endMs_ = nowMs;
}

uint32_t BasicGame::remainingMs(uint32_t nowMs) const {
  if (!running_ || modeId_ != BasicModeId::kSpinCount) return 0;
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
