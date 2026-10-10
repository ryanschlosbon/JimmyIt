#include "score_events.h"

namespace jimmyit {

ScoreEvent ScoreEventTracker::start(uint32_t previousBest) {
  previousBest_ = previousBest;
  lastScore_ = 0;
  beatBest_ = false;
  return ScoreEvent{ScoreEventKind::kGameStart, 0, previousBest};
}

size_t ScoreEventTracker::onScore(uint32_t score, ScoreEvent* out, size_t maxOut) {
  if (score <= lastScore_) return 0;
  size_t n = 0;
  const auto push = [&](uint8_t kind, uint32_t value) {
    if (n < maxOut) out[n++] = ScoreEvent{kind, score, value};
  };
  push(ScoreEventKind::kPoints, score - lastScore_);
  for (uint32_t m = (lastScore_ / kPointsPerMilestone + 1) * kPointsPerMilestone; m <= score; m += kPointsPerMilestone) {
    push(ScoreEventKind::kMilestone, m);
  }
  if (previousBest_ > 0 && !beatBest_ && score > previousBest_) {
    beatBest_ = true;
    push(ScoreEventKind::kNewBest, previousBest_);
  }
  lastScore_ = score;
  return n;
}

ScoreEvent ScoreEventTracker::end() const { return ScoreEvent{ScoreEventKind::kGameEnd, lastScore_, previousBest_}; }

}  // namespace jimmyit
