import { createGameTestHarness } from '@jimmyit/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { squeezeHold } from './squeeze-hold';

describe('squeeze-hold', () => {
  it('scores time spent inside the target band', async () => {
    const h = await createGameTestHarness(squeezeHold);

    h.fidget.squeeze(0.55);
    h.advance(5_000);
    expect(h.run.getState().inBand).toBe(true);
    expect(h.run.getScore().score).toBe(50);

    h.fidget.squeeze(0.95); // too hard: no points, hold resets
    h.advance(5_000);
    expect(h.run.getScore().score).toBe(50);
    expect(h.run.getState().currentHoldMs).toBe(0);

    const record = await h.playToEnd();
    expect(record).toMatchObject({
      gameId: 'squeeze-hold',
      source: 'app',
      score: 50,
      stars: 1,
      completed: true,
      newBest: true,
      actions: 1,
      durationMs: 30_000,
      metrics: { longestHoldMs: 5_000, inBandMs: 5_000 },
    });
    expect(await h.repository.best('squeeze-hold')).toEqual(record);
  });

  it('shows the result on the toy and celebrates a new best', async () => {
    const h = await createGameTestHarness(squeezeHold);
    h.fidget.squeeze(0.5);
    await h.playToEnd();

    expect(h.fidget.mode).toBe('app');
    expect(h.fidget.display.lines[0]).toBe('Squeeze & Hold');
    expect(h.fidget.display.score).toEqual({ score: 300, best: 300, stars: 3 });
    expect(h.fidget.haptics.at(-1)).toEqual([12, 14]); // Feedback.celebrate
  });

  it('saves an incomplete record when the child quits', async () => {
    const h = await createGameTestHarness(squeezeHold);
    h.advance(2_000);
    const record = await h.run.quit();
    expect(record).toMatchObject({ completed: false, score: 0, stars: 0, durationMs: 2_000 });
  });
});
