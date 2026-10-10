// Ported from the first app version's progress tests: same rewards, now
// computed from records saved by the shared games.
import { createAppScoreRecord, type ScoreRecord } from '@jimmyit/core';
import { describe, expect, it } from 'vitest';
import { getProgress } from './progress';

let counter = 0;
function record(gameId: string, score: number, options: { day?: number; metrics?: Record<string, number>; actions?: number } = {}): ScoreRecord {
  counter++;
  return createAppScoreRecord(
    {
      gameId,
      deviceId: null,
      startedAtMs: new Date(2026, 0, options.day ?? 1, 12).getTime() + counter,
      durationMs: 1000,
      snapshot: { score, actions: options.actions ?? 0, metrics: options.metrics ?? {} },
      stars: 0,
      completed: true,
      newBest: false,
    },
    () => counter / 1000,
  );
}

const badge = (records: ScoreRecord[], id: string) => getProgress(records).badges.find((b) => b.id === id);

describe('progress', () => {
  it('grows toy badges from timed practice and toy-played spin counts', () => {
    const records = [
      record('timed-motor-practice', 210, { metrics: { buttonPressCount: 10, spinCount: 25 } }),
      record('fidget-spin-count', 50, { actions: 5 }),
    ];
    expect(getProgress(records).points).toBe(260);
    expect(badge(records, 'buttons')).toMatchObject({ count: 10, goal: 10, earned: true });
    expect(badge(records, 'spinner')).toMatchObject({ count: 30, earned: true });
  });

  it('unlocks the shape badge from either shape game', () => {
    expect(badge([record('shape-challenge', 50)], 'shapes')?.earned).toBe(true);
    expect(badge([record('shape-recognition', 30)], 'shapes')?.earned).toBe(true);
    expect(badge([record('drawing-with-jimmy', 50)], 'shapes')?.earned).toBe(false);
  });

  it('advances a level every 250 points', () => {
    const records = [...Array.from({ length: 5 }, () => record('drawing-with-jimmy', 50)), record('drawing-with-jimmy', 10)];
    expect(getProgress(records)).toMatchObject({ points: 260, level: 2, levelPoints: 10, pointsToNextLevel: 240 });
  });

  it('counts consecutive local calendar days, not scattered visits', () => {
    const records = [1, 2, 4, 5, 6].map((day) => record('drawing-with-jimmy', 50, { day }));
    expect(badge(records, 'week')).toMatchObject({ count: 3, goal: 7, earned: false });
    expect(getProgress(records).longestStreakDays).toBe(3);
  });

  it('starts empty with nothing earned', () => {
    expect(getProgress([])).toMatchObject({ points: 0, level: 1, levelPoints: 0 });
    expect(getProgress([]).badges.every((b) => !b.earned)).toBe(true);
  });
});
