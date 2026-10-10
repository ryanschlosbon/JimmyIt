#include "celebration.h"

namespace jimmyit {

namespace {
// DRV2605L ROM effects; names match the app's Feedback presets.
constexpr uint8_t kTap = 7;          // Soft Bump
constexpr uint8_t kTick = 24;        // Sharp Tick 1
constexpr uint8_t kSuccess = 10;     // Double Click
constexpr uint8_t kTripleClick = 12;
constexpr uint8_t kStrongBuzz = 14;
}  // namespace

CelebrationStyle celebrationStyle(uint8_t kind, bool newBestAtEnd) {
  switch (kind) {
    case ScoreEventKind::kGameStart:
      return CelebrationStyle{700, 2, {kTap, 0}, 1, true};
    case ScoreEventKind::kPoints:
      return CelebrationStyle{350, 1, {kTick, 0}, 1, false};
    case ScoreEventKind::kMilestone:
      return CelebrationStyle{2000, 4, {kSuccess, 0}, 1, true};
    case ScoreEventKind::kNewBest:
      return CelebrationStyle{2500, 5, {kTripleClick, kStrongBuzz}, 2, true};
    case ScoreEventKind::kGameEnd:
      return newBestAtEnd ? CelebrationStyle{0, 3, {kTripleClick, kStrongBuzz}, 2, true}
                          : CelebrationStyle{0, 3, {kSuccess, 0}, 1, true};
    default:
      return CelebrationStyle{0, 0, {0, 0}, 0, false};
  }
}

bool Celebration::start(uint8_t kind, uint32_t score, uint32_t value, uint32_t nowMs, bool newBestAtEnd) {
  const CelebrationStyle style = celebrationStyle(kind, newBestAtEnd);
  if (style.priority == 0) return false;
  if (active(nowMs) && style.priority < priority_) return false;
  kind_ = kind;
  priority_ = style.priority;
  fullScreen_ = style.fullScreen;
  score_ = score;
  value_ = value;
  startMs_ = nowMs;
  durationMs_ = style.durationMs;
  return true;
}

bool Celebration::active(uint32_t nowMs) const { return durationMs_ > 0 && nowMs - startMs_ < durationMs_; }

}  // namespace jimmyit
