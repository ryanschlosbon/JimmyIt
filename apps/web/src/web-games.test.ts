import { describe, expect, it } from 'vitest';
import { createJimmyServices } from '@jimmyit/app-kit';
import { createMemoryKeyValueStore, type ScoreRecord } from '@jimmyit/core';
import { createAdaptiveTapGame, GAME_CATALOG, SHAPE_GAME, TAP_MODES } from './web-games';

describe('web game registry', () => {
  it('contains the same four play activities and toy scoreboard titles', () => {
    expect(TAP_MODES).toEqual(['precision', 'trace', 'memory', 'calm']);
    expect(SHAPE_GAME.id).toBe('shape-recognition');
    expect(GAME_CATALOG.map((entry) => entry.id)).toContain('drawing-with-jimmy');
    expect(GAME_CATALOG.map((entry) => entry.id)).toContain('timed-motor-practice');
  });

  it('starts the next Tap Quest at the saved level', () => {
    const record: ScoreRecord = {
      id: 'recent', gameId: 'tap-quest-precision', source: 'app', deviceId: null,
      startedAt: '2026-10-11T00:00:00.000Z', timeIsApproximate: false, durationMs: 1000,
      score: 20, stars: 1, completed: true, newBest: false, actions: 4,
      metrics: { level: 3, touchAttempts: 4, matchedTargets: 4, completionPercent: 100 },
      fidgetRecordId: null,
    };
    const services = createJimmyServices({ storage: createMemoryKeyValueStore(), connector: null });
    const run = services.play(createAdaptiveTapGame('precision', [record], 7));
    expect(run.getState().settings.level).toBeGreaterThanOrEqual(3);
    void run.quit();
  });
});
