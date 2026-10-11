#include "celebration.h"

namespace jimmyit {

namespace {
// DRV2605L ROM effects (TI effect list, library 6 for the LRA).
constexpr uint8_t kDoubleClick = 10;  // Double Click - 100%
constexpr uint8_t kTripleClick = 12;  // Triple Click - 100%
constexpr uint8_t kStrongBuzz = 14;   // Strong Buzz - 100%
constexpr uint8_t kBuzz = 47;         // Buzz 1 - 100%

CelebrationStyle style(uint16_t durationMs, uint8_t priority, bool fullScreen, uint8_t a = 0, uint8_t b = 0, uint8_t c = 0) {
  return CelebrationStyle{durationMs, priority, {a, b, c}, static_cast<uint8_t>((a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0)),
                          fullScreen};
}

// Bigger milestones feel bigger: 100, then 500, then 1000-2000, then 3000 and up.
CelebrationStyle milestoneStyle(uint32_t milestone) {
  if (milestone >= 3000) return style(2000, 4, true, kTripleClick, kStrongBuzz);
  if (milestone >= 1000) return style(2000, 4, true, kTripleClick, kBuzz);
  if (milestone >= 500) return style(2000, 4, true, kTripleClick);
  return style(2000, 4, true, kDoubleClick);
}
}  // namespace

CelebrationStyle celebrationStyle(uint8_t kind, uint32_t value, bool newBestAtEnd) {
  switch (kind) {
    case ScoreEventKind::kGameStart:
      return style(700, 2, true);
    case ScoreEventKind::kPoints:
      return style(350, 1, false);
    case ScoreEventKind::kMilestone:
      return milestoneStyle(value);
    case ScoreEventKind::kNewBest:
      return style(2500, 5, true, kStrongBuzz, kTripleClick, kStrongBuzz);  // the most intense
    case ScoreEventKind::kGameEnd:
      return newBestAtEnd ? style(0, 3, true, kTripleClick, kStrongBuzz) : style(0, 3, true, kDoubleClick);
    default:
      return style(0, 0, false);
  }
}

bool Celebration::start(uint8_t kind, uint32_t score, uint32_t value, uint32_t nowMs, bool newBestAtEnd) {
  const CelebrationStyle next = celebrationStyle(kind, value, newBestAtEnd);
  if (next.priority == 0) return false;
  if (active(nowMs) && next.priority < priority_) return false;
  kind_ = kind;
  priority_ = next.priority;
  fullScreen_ = next.fullScreen;
  score_ = score;
  value_ = value;
  startMs_ = nowMs;
  durationMs_ = next.durationMs;
  return true;
}

bool Celebration::active(uint32_t nowMs) const { return durationMs_ > 0 && nowMs - startMs_ < durationMs_; }

}  // namespace jimmyit
