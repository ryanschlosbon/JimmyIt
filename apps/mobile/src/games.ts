// The app's game registry: which games exist and how screens refer to them.
// Game authors add one import and one entry here (see games/AGENTS.md).
import { createGameCatalog } from '@jimmyit/app-kit';
import type { ScoreRecord } from '@jimmyit/core';
import { freeDrawing, shapeChallenge } from '@jimmyit/game-drawing';
import { createShapeRecognitionGame } from '@jimmyit/game-shape-recognition';
import { createTapQuestGame, type RecentAttempt, type TapQuestMode } from '@jimmyit/game-tap-quest';
import { createTimedPractice, TIMED_PRACTICE_DURATIONS_MS } from '@jimmyit/game-timed-practice';

export type Activity = 'drawing' | 'shapes';

export const DRAWING_GAMES = { drawing: freeDrawing, shapes: shapeChallenge } as const;

export const TIMED_PRACTICE_SECONDS = TIMED_PRACTICE_DURATIONS_MS.map((ms) => ms / 1000);
const timedPractice = new Map<number, ReturnType<typeof createTimedPractice>>(
  TIMED_PRACTICE_DURATIONS_MS.map((ms) => [ms, createTimedPractice(ms)]),
);
export function timedPracticeGame(durationMs: number) {
  return timedPractice.get(durationMs) ?? createTimedPractice(durationMs);
}

export const TAP_QUEST_MODES: readonly { readonly mode: TapQuestMode; readonly title: string; readonly caption: string }[] = [
  { mode: 'precision', title: 'Precision', caption: 'Touch each circle before it moves on.' },
  { mode: 'trace', title: 'Trace', caption: 'Follow the path with your stylus.' },
  { mode: 'memory', title: 'Memory', caption: 'Watch the order, then tap it back.' },
  { mode: 'calm', title: 'Calm', caption: 'No timer. Tap circles at your own pace.' },
];

const MAX_TAP_QUEST_LEVEL = 5;

/**
 * Tap Quest for this child: starts at the level of their last game in this mode
 * and lets the game adapt from their last five (at most one level per game).
 * `records` is newest first, as useScores() returns them.
 */
export function tapQuestGame(mode: TapQuestMode, records: readonly ScoreRecord[]) {
  const mine = records.filter((record) => record.gameId === `tap-quest-${mode}`).slice(0, 5).reverse();
  const lastLevel = mine[mine.length - 1]?.metrics.level ?? 1;
  const recentAttempts: RecentAttempt[] = mine
    .filter((record) => (record.metrics.touchAttempts ?? 0) > 0)
    .map((record) => ({
      accuracy: Math.min(1, (record.metrics.matchedTargets ?? 0) / (record.metrics.touchAttempts ?? 1)),
      completionRate: Math.min(1, (record.metrics.completionPercent ?? 0) / 100),
    }));
  const level = Math.max(1, Math.min(MAX_TAP_QUEST_LEVEL, Math.round(lastLevel)));
  return createTapQuestGame({ mode, level, recentAttempts });
}

/** Titles and facts for menus and scoreboards, including games the toy plays by itself. */
export const GAME_CATALOG = createGameCatalog([
  freeDrawing,
  shapeChallenge,
  createTimedPractice(),
  ...TAP_QUEST_MODES.map(({ mode }) => createTapQuestGame({ mode })),
  createShapeRecognitionGame(),
]);
