import { createAppScoreRecord, type ScoreRecord } from '@jimmyit/core';
import { describe, expect, it } from 'vitest';
import { DRAWING_GAMES, GAME_CATALOG, PLAY_SHELF, SHAPE_CHALLENGE_GAME, tapQuestGame,
  TIMED_PRACTICE_SECONDS, timedPracticeGame } from './games';

function tapQuestRecord(mode: string, metrics: Record<string, number>, minutesAgo: number): ScoreRecord {
  return createAppScoreRecord({
    gameId: `tap-quest-${mode}`, deviceId: null, startedAtMs: Date.UTC(2026, 9, 10, 12) - minutesAgo * 60_000,
    durationMs: 30_000, snapshot: { score: 50, actions: 10, metrics }, stars: 1, completed: true, newBest: false,
  });
}

describe('game registry', () => {
  it('plays circle, triangle, square, and rectangle locally before saving one record', async () => {
    const { createGameTestHarness } = await import('@jimmyit/game-sdk/testing');
    const h = await createGameTestHarness(SHAPE_CHALLENGE_GAME, { toy: false });
    const circle = Array.from({ length: 37 }, (_, index) => ({
      x: 500 + 200 * Math.cos(index * 2 * Math.PI / 36),
      y: 325 + 200 * Math.sin(index * 2 * Math.PI / 36),
    }));
    const drawings = [circle,
      [{ x: 500, y: 100 }, { x: 760, y: 540 }, { x: 240, y: 540 }, { x: 500, y: 100 }],
      [{ x: 290, y: 115 }, { x: 710, y: 115 }, { x: 710, y: 535 }, { x: 290, y: 535 }, { x: 290, y: 115 }],
      [{ x: 200, y: 180 }, { x: 800, y: 180 }, { x: 800, y: 480 }, { x: 200, y: 480 }, { x: 200, y: 180 }],
    ];
    for (const [index, points] of drawings.entries()) {
      expect(h.run.getState().target).toBe(['circle', 'triangle', 'square', 'rectangle'][index]);
      h.run.submit({ type: 'submitDrawing', submissionId: String(index),
        drawing: { width: 1000, height: 650, strokes: [points] } });
      expect(h.run.getState().matchedCount).toBe(index + 1);
    }
    const record = await h.run.result;
    expect(record).toMatchObject({ completed: true, metrics: { matchedShapes: 4, drawingSubmissions: 4 } });
    expect(await h.repository.list({ gameId: 'shape-recognition' })).toEqual([record]);
  });
  it('lists every app game and every toy game, once each', () => {
    const ids = GAME_CATALOG.map(game => game.id);
    expect(ids).toEqual([
      'drawing-with-jimmy', 'shape-challenge', 'timed-motor-practice',
      'tap-quest-precision', 'tap-quest-trace', 'tap-quest-memory', 'tap-quest-calm', 'shape-recognition',
      'button-hero-normal', 'knob-quest',
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

  it('shows the Shape Challenge banner the score of the game its screen plays', () => {
    const shapes = PLAY_SHELF.find(game => game.id === 'shapes');
    expect(shapes?.scoreGameId(null)).toBe(SHAPE_CHALLENGE_GAME.id);
  });
});

describe('Tap Quest difficulty', () => {
  it('passes a new pattern seed through to each game', async () => {
    const { createGameTestHarness } = await import('@jimmyit/game-sdk/testing');
    const first = await createGameTestHarness(tapQuestGame('precision', [], 101), { toy: false });
    const second = await createGameTestHarness(tapQuestGame('precision', [], 102), { toy: false });
    expect(first.run.getState().target).not.toEqual(second.run.getState().target);
  });

  it('passes generated target positions into a playable game', async () => {
    const { createGameTestHarness } = await import('@jimmyit/game-sdk/testing');
    const points = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }] as const;
    const game = tapQuestGame('precision', [], 101, points);
    const h = await createGameTestHarness(game, { toy: false });
    expect(h.run.getState().target).toMatchObject(points[0]);
  });
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
