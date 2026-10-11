#include "score_events.h"

namespace jimmyit {

uint32_t nextMilestoneAfter(uint32_t score) {
  for (size_t i = 0; i < kMilestoneScoreCount; i++) {
    if (kMilestoneScores[i] > score) return kMilestoneScores[i];
  }
  const uint32_t last = kMilestoneScores[kMilestoneScoreCount - 1];
  return last + ((score - last) / kMilestoneStepAfterLast + 1) * kMilestoneStepAfterLast;
}

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
  // `m > previous` stops the loop if a milestone near UINT32_MAX would wrap.
  for (uint32_t m = nextMilestoneAfter(lastScore_), previous = lastScore_; m <= score && m > previous;
       previous = m, m = nextMilestoneAfter(m)) {
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
