export interface RecentAttempt {
  readonly accuracy: number;
  readonly completionRate: number;
}

export interface DifficultySettings {
  readonly level: number;
  readonly targetRadius: number;
  readonly targetSpacing: number;
  readonly targetCount: number;
  readonly targetDurationMs: number;
  readonly timingWindowMs: number;
  readonly sequenceLength: number;
}

/** Uses only recent play results and changes difficulty by at most one level. */
export function recommendTapQuestDifficulty(
  selectedLevel: number,
  attempts: readonly RecentAttempt[],
  allowIncrease = true,
): DifficultySettings {
  if (!Number.isInteger(selectedLevel) || selectedLevel < 1 || selectedLevel > 5) {
    throw new RangeError('difficulty level must be 1 through 5');
  }
  const recent = attempts.slice(-5);
  if (recent.some((attempt) => !Number.isFinite(attempt.accuracy) || attempt.accuracy < 0 ||
    attempt.accuracy > 1 || !Number.isFinite(attempt.completionRate) ||
    attempt.completionRate < 0 || attempt.completionRate > 1)) {
    throw new RangeError('accuracy and completion rates must be between zero and one');
  }
  let level = selectedLevel;
  if (recent.length >= 3) {
    const accuracy = recent.reduce((sum, item) => sum + item.accuracy, 0) / recent.length;
    const completion = recent.reduce((sum, item) => sum + item.completionRate, 0) / recent.length;
    if ((accuracy < 0.55 || completion < 0.6) && level > 1) level--;
    else if (accuracy >= 0.88 && completion >= 0.9 && allowIncrease && level < 5) level++;
  }
  return {
    level,
    targetRadius: 0.105 - level * 0.009,
    targetSpacing: 0.18 + level * 0.025,
    targetCount: 3 + level * 2,
    targetDurationMs: 3400 - level * 350,
    timingWindowMs: 700 - level * 80,
    sequenceLength: 2 + level,
  };
}
