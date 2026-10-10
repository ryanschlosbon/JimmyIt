import { describe, expect, it } from 'vitest';
import type { ScoreRecord } from '../scoring/types';
import { createMemoryKeyValueStore } from './key-value-store';
import { createScoreRepository, SCORE_STORAGE_KEY, ScoreStorageError } from './score-repository';

function record(id: string, gameId: string, score: number, day: number): ScoreRecord {
  return {
    id,
    gameId,
    source: 'app',
    deviceId: null,
    startedAt: new Date(Date.UTC(2026, 9, day)).toISOString(),
    timeIsApproximate: false,
    durationMs: 1000,
    score,
    stars: 0,
    completed: true,
    newBest: false,
    actions: 1,
    metrics: {},
    fidgetRecordId: null,
  };
}

describe('score repository', () => {
  it('saves idempotently and lists newest first', async () => {
    const repo = createScoreRepository(createMemoryKeyValueStore());
    expect(await repo.save(record('a', 'spin', 10, 1))).toBe(true);
    expect(await repo.save(record('a', 'spin', 10, 1))).toBe(false);
    expect(await repo.saveMany([record('b', 'spin', 30, 3), record('c', 'squeeze', 5, 2), record('b', 'spin', 30, 3)])).toBe(2);
    expect((await repo.list()).map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect((await repo.list({ gameId: 'spin', limit: 1 })).map((r) => r.id)).toEqual(['b']);
  });

  it('finds bests and summarizes', async () => {
    const repo = createScoreRepository(createMemoryKeyValueStore());
    await repo.saveMany([record('a', 'spin', 30, 1), record('b', 'spin', 30, 2), record('c', 'squeeze', 5, 3)]);
    expect((await repo.best('spin'))?.id).toBe('a');
    expect(await repo.best('nothing')).toBeNull();
    const summary = await repo.summary();
    expect(summary).toMatchObject({ sessions: 3, totalScore: 65, totalPlayMs: 3000 });
    expect(summary.games.map((g) => [g.gameId, g.bestScore, g.sessions])).toEqual([
      ['squeeze', 5, 1],
      ['spin', 30, 2],
    ]);
  });

  it('persists through the store and survives concurrent writes', async () => {
    const store = createMemoryKeyValueStore();
    const repo = createScoreRepository(store);
    await Promise.all([repo.save(record('a', 'spin', 1, 1)), repo.save(record('b', 'spin', 2, 2)), repo.setSyncCursor('0000f1d6', 7)]);
    const reopened = createScoreRepository(store);
    expect((await reopened.list()).length).toBe(2);
    expect(await reopened.getSyncCursor('0000f1d6')).toBe(7);
  });

  it('refuses to touch data from an unknown schema version', async () => {
    const store = createMemoryKeyValueStore({ [SCORE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 99, records: [] }) });
    const repo = createScoreRepository(store);
    await expect(repo.save(record('a', 'spin', 1, 1))).rejects.toThrow(ScoreStorageError);
    expect(JSON.parse((await store.getItem(SCORE_STORAGE_KEY)) ?? '').schemaVersion).toBe(99);
  });

  it('notifies listeners on change', async () => {
    const repo = createScoreRepository(createMemoryKeyValueStore());
    let changes = 0;
    repo.onChange(() => changes++);
    await repo.save(record('a', 'spin', 1, 1));
    await repo.save(record('a', 'spin', 1, 1));
    expect(changes).toBe(1);
  });
});
