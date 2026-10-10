import { describe, expect, it } from 'vitest';
import { analyzePattern, recommendDifficulty } from './pattern-analysis';

describe('pattern analysis', () => {
  it('reports sequence quality, timing, holds, and missed actions', () => {
    expect(analyzePattern(['a', 'b', 'c'], [
      { buttonId: 'a', pressedAtMs: 100, durationMs: 80 },
      { buttonId: 'x', pressedAtMs: 300, durationMs: 120 },
    ])).toEqual({
      correctInputs: 1, incorrectInputs: 1, missedInputs: 1, accuracy: 1 / 3,
      completed: false, averageIntervalMs: 200, averageHoldMs: 100,
    });
    expect(analyzePattern(['a'], [{ buttonId: 'a', pressedAtMs: 0, durationMs: 10 }]).completed).toBe(true);
  });

  it('requires completed attempts and respects accessibility limits', () => {
    const high = Array.from({ length: 5 }, () => ({ accuracy: 0.95, completed: true }));
    const prefs = { selectedDifficulty: 2, maximumDifficulty: 3, allowAutomaticIncrease: true };
    expect(recommendDifficulty(high.slice(0, 4), prefs).reason).toBe('insufficientAttempts');
    expect(recommendDifficulty(high, prefs)).toEqual({ difficulty: 3, reason: 'increase' });
    expect(recommendDifficulty(high, { ...prefs, allowAutomaticIncrease: false }).difficulty).toBe(2);
    expect(recommendDifficulty(high, { ...prefs, maximumDifficulty: 2 }).difficulty).toBe(2);
    expect(recommendDifficulty(high.map(() => ({ accuracy: 0.2, completed: true })), prefs))
      .toEqual({ difficulty: 1, reason: 'ease' });
  });

  it('rejects invalid timing', () => {
    expect(() => analyzePattern(['a'], [{ buttonId: 'a', pressedAtMs: 1, durationMs: -1 }])).toThrow(RangeError);
  });
});
