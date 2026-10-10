export interface PatternAction {
  readonly buttonId: string;
  readonly pressedAtMs: number;
  readonly durationMs: number;
}

export interface PatternAnalysis {
  readonly correctInputs: number;
  readonly incorrectInputs: number;
  readonly missedInputs: number;
  readonly accuracy: number;
  readonly completed: boolean;
  readonly averageIntervalMs: number | null;
  readonly averageHoldMs: number | null;
}

export interface CompletedAttempt {
  readonly accuracy: number;
  readonly completed: boolean;
}

export interface AccessibilityPreferences {
  readonly selectedDifficulty: number;
  readonly maximumDifficulty: number;
  readonly allowAutomaticIncrease: boolean;
}

export interface DifficultyRecommendation {
  readonly difficulty: number;
  readonly reason: 'insufficientAttempts' | 'steady' | 'increase' | 'ease';
}

/** Evaluates an ordered sequence without storing input history or inferring health information. */
export function analyzePattern(expected: readonly string[], actions: readonly PatternAction[]): PatternAnalysis {
  if (expected.some((id) => id.length === 0)) throw new RangeError('expected button IDs must not be empty');
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (!action) throw new RangeError('action is missing');
    const previous = i > 0 ? actions[i - 1] : undefined;
    if (!action.buttonId || !Number.isFinite(action.pressedAtMs) || action.pressedAtMs < 0 ||
      !Number.isFinite(action.durationMs) || action.durationMs < 0 ||
      (previous !== undefined && action.pressedAtMs < previous.pressedAtMs)) {
      throw new RangeError('actions must have valid IDs, durations, and ordered timestamps');
    }
  }
  let correctInputs = 0;
  let incorrectInputs = 0;
  for (let i = 0; i < actions.length; i++) {
    if (i < expected.length && actions[i]?.buttonId === expected[i]) correctInputs++;
    else incorrectInputs++;
  }
  const missedInputs = Math.max(0, expected.length - actions.length);
  const denominator = Math.max(expected.length, actions.length, 1);
  const intervals = actions.slice(1).map((action, index) => action.pressedAtMs - (actions[index]?.pressedAtMs ?? action.pressedAtMs));
  return {
    correctInputs,
    incorrectInputs,
    missedInputs,
    accuracy: correctInputs / denominator,
    completed: actions.length >= expected.length && incorrectInputs === 0,
    averageIntervalMs: intervals.length === 0 ? null : intervals.reduce((sum, value) => sum + value, 0) / intervals.length,
    averageHoldMs: actions.length === 0 ? null : actions.reduce((sum, action) => sum + action.durationMs, 0) / actions.length,
  };
}

/** Recommends at most one difficulty step from the five most recent completed attempts. */
export function recommendDifficulty(
  attempts: readonly CompletedAttempt[],
  preferences: AccessibilityPreferences,
): DifficultyRecommendation {
  const { selectedDifficulty, maximumDifficulty, allowAutomaticIncrease } = preferences;
  if (!Number.isInteger(selectedDifficulty) || selectedDifficulty < 1 ||
    !Number.isInteger(maximumDifficulty) || maximumDifficulty < selectedDifficulty) {
    throw new RangeError('difficulty preferences must be positive integers within the selected limit');
  }
  const recent = attempts.filter((attempt) => attempt.completed).slice(-5);
  if (recent.length < 5) return { difficulty: selectedDifficulty, reason: 'insufficientAttempts' };
  if (recent.some((attempt) => !Number.isFinite(attempt.accuracy) || attempt.accuracy < 0 || attempt.accuracy > 1)) {
    throw new RangeError('accuracy must be between zero and one');
  }
  const average = recent.reduce((sum, attempt) => sum + attempt.accuracy, 0) / recent.length;
  if (average < 0.45 && selectedDifficulty > 1) return { difficulty: selectedDifficulty - 1, reason: 'ease' };
  if (average >= 0.85 && allowAutomaticIncrease && selectedDifficulty < maximumDifficulty) {
    return { difficulty: selectedDifficulty + 1, reason: 'increase' };
  }
  return { difficulty: selectedDifficulty, reason: 'steady' };
}
