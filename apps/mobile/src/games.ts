// The app's game registry: which games exist and how screens refer to them.
// Game authors add one import and one entry here (see games/AGENTS.md).
import { createGameCatalog } from '@jimmyit/app-kit';
import { freeDrawing, shapeChallenge } from '@jimmyit/game-drawing';
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

/** Titles and facts for menus and scoreboards, including games the toy plays by itself. */
export const GAME_CATALOG = createGameCatalog([freeDrawing, shapeChallenge, createTimedPractice()]);
