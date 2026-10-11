import { describe, expect, it } from 'vitest';
import type { Badge, Progress } from './progress';
import { progressRewards } from './rewards';

function progress(level: number, earned: readonly Badge['id'][]): Progress {
  const ids: readonly Badge['id'][] = ['first', 'shapes', 'buttons', 'spinner', 'drawing', 'week'];
  return {
    points: (level - 1) * 250,
    level,
    levelPoints: 0,
    pointsToNextLevel: 250,
    longestStreakDays: 0,
    badges: ids.map((id) => ({ id, label: id, count: 0, goal: 1, earned: earned.includes(id) })),
  };
}

describe('progressRewards', () => {
  it('reports one level-up to the new level, then each newly earned badge', () => {
    expect(progressRewards(progress(1, []), progress(3, ['first', 'shapes']))).toEqual([
      { type: 'levelUp', level: 3 },
      { type: 'badge', badgeId: 'first' },
      { type: 'badge', badgeId: 'shapes' },
    ]);
  });

  it('reports nothing for badges already earned, or when progress goes back (scores cleared)', () => {
    expect(progressRewards(progress(2, ['first']), progress(2, ['first']))).toEqual([]);
    expect(progressRewards(progress(4, ['first']), progress(1, []))).toEqual([]);
  });
});
