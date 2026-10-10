import type { ScoreRecord } from '@jimmyit/core';

export const POINTS_PER_LEVEL = 250;
const DAY_MS = 86_400_000;

export type BadgeId = 'first' | 'shapes' | 'buttons' | 'spinner' | 'drawing' | 'week';

/** Data only: the app decides each badge's icon, color and art from its id. */
export interface Badge {
  readonly id: BadgeId;
  readonly label: string;
  readonly count: number;
  readonly goal: number;
  readonly earned: boolean;
}

export interface Progress {
  readonly points: number;
  readonly level: number;
  /** Points earned inside the current level, 0 to POINTS_PER_LEVEL - 1. */
  readonly levelPoints: number;
  readonly pointsToNextLevel: number;
  readonly longestStreakDays: number;
  readonly badges: readonly Badge[];
}

const SHAPE_GAMES = new Set(['shape-challenge', 'shape-recognition']);

function metric(record: ScoreRecord, name: string): number {
  return record.metrics[name] ?? 0;
}

/** Longest run of consecutive local calendar days with at least one session. */
export function longestStreakDays(records: readonly ScoreRecord[]): number {
  const days = new Set(
    records.map((record) => {
      const date = new Date(record.startedAt);
      return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    }),
  );
  let streak = 0;
  let longest = 0;
  let previous: number | undefined;
  for (const day of [...days].sort((a, b) => a - b)) {
    streak = previous !== undefined && day - previous === DAY_MS ? streak + 1 : 1;
    longest = Math.max(longest, streak);
    previous = day;
  }
  return longest;
}

/** Levels and badges, derived only from saved records (app and toy). */
export function getProgress(records: readonly ScoreRecord[]): Progress {
  const points = records.reduce((sum, record) => sum + record.score, 0);
  const count = (predicate: (record: ScoreRecord) => boolean) => records.filter(predicate).length;
  const sum = (value: (record: ScoreRecord) => number) => records.reduce((total, record) => total + value(record), 0);

  const presses = sum((r) => (r.gameId === 'timed-motor-practice' ? metric(r, 'buttonPressCount') : 0));
  const spins = sum((r) =>
    r.gameId === 'timed-motor-practice' ? metric(r, 'spinCount') : r.gameId === 'fidget-spin-count' ? r.actions : 0,
  );
  const streak = longestStreakDays(records);

  const badge = (id: BadgeId, label: string, value: number, goal: number): Badge => ({
    id,
    label,
    count: value,
    goal,
    earned: value >= goal,
  });

  const levelPoints = points % POINTS_PER_LEVEL;
  return {
    points,
    level: Math.floor(points / POINTS_PER_LEVEL) + 1,
    levelPoints,
    pointsToNextLevel: POINTS_PER_LEVEL - levelPoints,
    longestStreakDays: streak,
    badges: [
      badge('first', 'First Click', records.length, 1),
      badge('shapes', 'Shape Star', count((r) => SHAPE_GAMES.has(r.gameId)), 1),
      badge('buttons', 'Button Buddy', presses, 10),
      badge('spinner', 'Super Spinner', spins, 30),
      badge('drawing', 'Drawing Pro', count((r) => r.gameId === 'drawing-with-jimmy'), 10),
      badge('week', 'Week Streak', streak, 7),
    ],
  };
}
