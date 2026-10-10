import type { AccessibilityPreferences, Difficulty, GameType, PerformanceMetrics,
  PersonalizationRecommendation, RoundMetrics } from './types';

function validRound(round: RoundMetrics): boolean {
  return Number.isFinite(round.accuracy) && round.accuracy >= 0 && round.accuracy <= 1 &&
    Number.isFinite(round.completionRate) && round.completionRate >= 0 && round.completionRate <= 1 &&
    Number.isInteger(round.successfulInputs) && round.successfulInputs >= 0 &&
    Number.isInteger(round.incorrectInputs) && round.incorrectInputs >= 0 &&
    (round.averageResponseMs === undefined ||
      (Number.isFinite(round.averageResponseMs) && round.averageResponseMs >= 0));
}

/** Uses at least three completed rounds before moving one difficulty step. */
export function getPersonalizationRecommendation(
  metrics: PerformanceMetrics,
  preferences: AccessibilityPreferences,
): PersonalizationRecommendation {
  const current = metrics.currentDifficulty;
  if (!Number.isInteger(current) || current < 1 || current > 5 ||
    (metrics.manualDifficulty !== undefined && (!Number.isInteger(metrics.manualDifficulty) ||
      metrics.manualDifficulty < 1 || metrics.manualDifficulty > 5)) ||
    metrics.recentRounds.some((round) => !validRound(round))) {
    throw new RangeError('invalid performance metrics');
  }
  const recent = metrics.recentRounds.slice(-5);
  const average = (key: 'accuracy' | 'completionRate'): number =>
    recent.reduce((sum, round) => sum + round[key], 0) / recent.length;
  const selected = metrics.manualDifficulty ?? current;
  let level = Math.min(selected, preferences.maximumDifficulty) as Difficulty;
  let explanation = 'Keep practicing at your chosen pace.';
  if (metrics.manualDifficulty === undefined && recent.length >= 3) {
    if ((average('accuracy') < 0.6 || average('completionRate') < 0.6) && level > 1) {
      level = (level - 1) as Difficulty;
      explanation = 'Try larger targets and a little more time.';
    } else if (average('accuracy') >= 0.9 && average('completionRate') >= 0.9 &&
      level < preferences.maximumDifficulty) {
      level = (level + 1) as Difficulty;
      explanation = 'Ready to explore a new challenge if you like.';
    }
  }
  const next: GameType = average('accuracy') < 0.6 && recent.length >= 3 ? 'calm' : 'tapQuest';
  return { currentDifficulty: current, recommendedDifficulty: level,
    suggestedTargetRadius: Math.max(preferences.minimumTargetRadius, 0.12 - level * 0.01),
    suggestedTargetCount: Math.min(9, 2 + level),
    suggestedResponseWindowMs: preferences.untimed ? null : 4_000 - level * 300,
    suggestedSequenceLength: Math.min(12, 2 + level),
    suggestedRoundLengthMs: preferences.untimed ? null : 30_000 + level * 10_000,
    suggestedDistractions: preferences.allowDistractions && level >= 4,
    suggestedNextActivity: next, explanation, source: 'local' };
}
