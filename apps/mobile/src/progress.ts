import {
  createAppScoreRecord, createScoreRepository, starsFor, type KeyValueStore, type ScoreRecord, type ScoreRepository,
} from '@jimmyit/core';
import type { TimedResult } from './timed-challenge';

export type Activity = 'drawing' | 'shapes';
export interface DrawingSession {
  readonly id: string;
  readonly activity: Activity;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly strokes: number;
}

/** Saves one stable record per drawing, including safe retries after a storage error. */
export function createProgressService(store: KeyValueStore): {
  readonly repository: ScoreRepository;
  readonly finish: (session: DrawingSession) => Promise<void>;
  readonly finishTimed: (session: TimedResult) => Promise<number>;
} {
  const repository = createScoreRepository(store);
  return {
    repository,
    async finish(session) {
      const score = session.strokes > 0 ? 50 : 10;
      const record = createAppScoreRecord({
        gameId: session.activity === 'shapes' ? 'shape-challenge' : 'drawing-with-jimmy',
        deviceId: null,
        startedAtMs: session.startedAtMs,
        durationMs: Math.max(0, session.durationMs),
        snapshot: { score, actions: session.strokes, metrics: { strokeCount: session.strokes } },
        stars: session.strokes > 0 ? 3 : 1,
        completed: true,
        newBest: false,
      }, () => 0);
      await repository.save({ ...record, id: session.id });
    },
    async finishTimed(session) {
      const actions = session.actions.press + session.actions.spin + session.actions.squeeze;
      const score = Math.max(10, actions * 5);
      const record = createAppScoreRecord({
        gameId: 'timed-motor-practice', deviceId: null, startedAtMs: session.startedAtMs,
        durationMs: session.durationMs, snapshot: { score, actions, metrics: {
          buttonPressCount: session.actions.press, spinCount: session.actions.spin, squeezeCount: session.actions.squeeze,
        } },
        stars: starsFor(score, [10, 50, 100]), completed: true, newBest: false,
      }, () => 0);
      await repository.save({ ...record, id: session.id });
      return score;
    },
  };
}

/** Derives all rewards from locally saved sessions, with no sample scores mixed in. */
export function getProgress(records: readonly ScoreRecord[]) {
  const points = records.reduce((sum, record) => sum + record.score, 0);
  const drawings = records.filter(record => record.gameId === 'drawing-with-jimmy').length;
  const shapes = records.filter(record => record.gameId === 'shape-challenge').length;
  const presses = records.reduce((sum, record) => sum + (record.gameId === 'timed-motor-practice'
    ? record.metrics.buttonPressCount ?? 0 : 0), 0);
  const spins = records.reduce((sum, record) => sum + (record.gameId === 'timed-motor-practice'
    ? record.metrics.spinCount ?? 0 : record.gameId === 'fidget-spin-count' ? record.actions : 0), 0);
  const dates = new Set(records.map(record => {
    const date = new Date(record.startedAt);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }));
  let streak = 0;
  let longestStreak = 0;
  let previous: number | undefined;
  for (const day of [...dates].sort((a, b) => a - b)) {
    streak = previous !== undefined && day - previous === 86_400_000 ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    previous = day;
  }
  return {
    points, level: Math.floor(points / 250) + 1, levelPoints: points % 250,
    badges: [
      { id: 'first', label: 'First Click', icon: 'sparkle', color: 'coral', count: records.length, goal: 1 },
      { id: 'shapes', label: 'Shape Star', icon: 'shapes', color: 'mint', count: shapes, goal: 1 },
      { id: 'buttons', label: 'Button Buddy', icon: 'toy', color: 'pink', count: presses, goal: 10 },
      { id: 'spinner', label: 'Super Spinner', icon: 'spin', color: 'yellow', count: spins, goal: 30 },
      { id: 'drawing', label: 'Drawing Pro', icon: 'pencil', color: 'teal', count: drawings, goal: 10 },
      { id: 'week', label: 'Week Streak', icon: 'flame', color: 'purple', count: longestStreak, goal: 7 },
    ] as const,
  };
}
