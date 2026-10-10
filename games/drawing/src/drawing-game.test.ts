import { createGameTestHarness, createMemoryKeyValueStore } from '@jimmyit/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { freeDrawing, shapeChallenge } from './drawing-game';

describe('drawing games', () => {
  it('run with no toy connected and save one record per drawing', async () => {
    const h = await createGameTestHarness(freeDrawing, { toy: false });
    h.advance(4_000);
    h.run.submit({ type: 'finish', strokeCount: 3 });
    h.run.submit({ type: 'finish', strokeCount: 9 }); // a double tap on "All done" changes nothing
    const record = await h.run.result;
    expect(record).toMatchObject({
      gameId: 'drawing-with-jimmy',
      deviceId: null,
      score: 50,
      stars: 3,
      actions: 3,
      durationMs: 4_000,
      metrics: { strokeCount: 3 },
    });
    expect(await h.repository.list()).toHaveLength(1);
  });

  it('give partial credit for an empty canvas', async () => {
    const h = await createGameTestHarness(shapeChallenge, { toy: false });
    h.run.submit({ type: 'finish', strokeCount: 0 });
    expect(await h.run.result).toMatchObject({ gameId: 'shape-challenge', score: 10, stars: 1 });
  });

  it('retry a failed save with the same record, never twice', async () => {
    const store = createMemoryKeyValueStore();
    let failNext = true;
    const flaky = {
      ...store,
      async setItem(key: string, value: string) {
        if (failNext) {
          failNext = false;
          throw new Error('disk full');
        }
        await store.setItem(key, value);
      },
    };
    const h = await createGameTestHarness(freeDrawing, { toy: false, storage: flaky });
    h.run.submit({ type: 'finish', strokeCount: 2 });
    await expect.poll(() => h.run.saveStatus).toBe('failed');
    const first = await h.run.retrySave();
    const second = await h.run.retrySave();
    expect(second.id).toBe(first.id);
    expect(await h.repository.list()).toHaveLength(1);
    expect(h.run.saveStatus).toBe('saved');
  });
});
