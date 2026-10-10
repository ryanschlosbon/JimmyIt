import { createAppScoreRecord, type ScoreRecord } from '@jimmyit/core';
import { describe, expect, it } from 'vitest';
import { DRAWING_GAMES, GAME_CATALOG, tapQuestGame, TIMED_PRACTICE_SECONDS, timedPracticeGame } from './games';

function tapQuestRecord(mode: string, metrics: Record<string, number>, minutesAgo: number): ScoreRecord {
  return createAppScoreRecord({
    gameId: `tap-quest-${mode}`, deviceId: null, startedAtMs: Date.UTC(2026, 9, 10, 12) - minutesAgo * 60_000,
    durationMs: 30_000, snapshot: { score: 50, actions: 10, metrics }, stars: 1, completed: true, newBest: false,
  });
}

describe('game registry', () => {
  it('lists every app game and every toy game, once each', () => {
    const ids = GAME_CATALOG.map(game => game.id);
    expect(ids).toEqual([
      'drawing-with-jimmy', 'shape-challenge', 'timed-motor-practice',
      'tap-quest-precision', 'tap-quest-trace', 'tap-quest-memory', 'tap-quest-calm', 'shape-recognition',
      'fidget-free-play', 'fidget-spin-count',
    ]);
    expect(GAME_CATALOG.find(game => game.id === 'tap-quest-memory')).toMatchObject({ needsToy: false, title: 'Tap Quest: Memory' });
    expect(GAME_CATALOG.find(game => game.id === 'drawing-with-jimmy')).toMatchObject({ needsToy: false, playedOn: 'app' });
    expect(GAME_CATALOG.find(game => game.id === 'fidget-free-play')).toMatchObject({ playedOn: 'toy' });
  });

  it('offers each practice length with the shared timed-practice id', () => {
    expect(TIMED_PRACTICE_SECONDS).toEqual([30, 60, 90]);
    expect(timedPracticeGame(60_000)).toMatchObject({ id: 'timed-motor-practice', durationMs: 60_000 });
    expect(timedPracticeGame(60_000)).toBe(timedPracticeGame(60_000));
    expect(DRAWING_GAMES.shapes.id).toBe('shape-challenge');
  });
});

describe('Tap Quest difficulty', () => {
  it('starts new players at level 1', () => {
    expect(tapQuestGame('precision', []).create).toBeTypeOf('function');
    expect(tapQuestGame('precision', []).id).toBe('tap-quest-precision');
  });

  it('continues from the last level and steps up after strong recent games, one level at a time', async () => {
    const strong = { matchedTargets: 9, touchAttempts: 10, completionPercent: 100, level: 2 };
    // Newest first, as useScores() returns them.
    const records = [3, 2, 1].map(minutes => tapQuestRecord('precision', strong, minutes));
    const game = tapQuestGame('precision', records);
    const { createGameTestHarness } = await import('@jimmyit/game-sdk/testing');
    const h = await createGameTestHarness(game, { toy: false });
    expect(h.run.getState().settings.level).toBe(3);
    // Other modes keep their own level.
    const trace = await createGameTestHarness(tapQuestGame('trace', records), { toy: false });
    expect(trace.run.getState().settings.level).toBe(1);
  });

  it('eases off after a few hard games', async () => {
    const hard = { matchedTargets: 2, touchAttempts: 10, completionPercent: 40, level: 3 };
    const records = [3, 2, 1].map(minutes => tapQuestRecord('memory', hard, minutes));
    const { createGameTestHarness } = await import('@jimmyit/game-sdk/testing');
    const h = await createGameTestHarness(tapQuestGame('memory', records), { toy: false });
    expect(h.run.getState().settings.level).toBe(2);
  });
});
