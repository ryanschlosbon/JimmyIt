// Decides when a game's score moments happen (PROTOCOL.md "Score events").
// The same rules as the app's createScoreEventTracker in packages/core.
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "fidget_protocol.h"

namespace jimmyit {

// The first milestone strictly above `score`: 100, 500, 1000, 1500, 2000, 3000,
// then every 1000. Same as nextMilestoneAfter in packages/protocol.
uint32_t nextMilestoneAfter(uint32_t score);

struct ScoreEvent {
  uint8_t kind;  // ScoreEventKind
  uint32_t score;
  uint32_t value;
};

class ScoreEventTracker {
 public:
  // At most: points + a few milestones + newBest from one score change
  // (0 → 3000 in one jump is points + 6 milestones + newBest).
  static constexpr size_t kMaxEventsPerChange = 8;

  // Returns the gameStart event.
  ScoreEvent start(uint32_t previousBest);
  // Feeds the game's total score; writes the events it caused to `out` and
  // returns how many (0 if the score didn't go up).
  size_t onScore(uint32_t score, ScoreEvent* out, size_t maxOut);
  ScoreEvent end() const;

  uint32_t previousBest() const { return previousBest_; }
  bool beatBest() const { return beatBest_; }

 private:
  uint32_t previousBest_ = 0;
  uint32_t lastScore_ = 0;
  bool beatBest_ = false;
};

}  // namespace jimmyit
