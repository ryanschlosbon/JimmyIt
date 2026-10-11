// When a game's `milestone` score event fires (PROTOCOL.md "Score events").
// The firmware has the same rule in score_events.cpp (kMilestoneScores).

/** Scores that are milestones, in order. After the last one, every MILESTONE_STEP_AFTER_LAST is one too. */
export const MILESTONE_SCORES: readonly number[] = [100, 500, 1000, 1500, 2000, 3000];

/** Spacing of milestones beyond the last of MILESTONE_SCORES (4000, 5000, …). */
export const MILESTONE_STEP_AFTER_LAST = 1000;

/** The first milestone strictly above `score`. */
export function nextMilestoneAfter(score: number): number {
  for (const milestone of MILESTONE_SCORES) {
    if (milestone > score) return milestone;
  }
  const last = MILESTONE_SCORES[MILESTONE_SCORES.length - 1] ?? 0;
  return last + (Math.floor((score - last) / MILESTONE_STEP_AFTER_LAST) + 1) * MILESTONE_STEP_AFTER_LAST;
}
