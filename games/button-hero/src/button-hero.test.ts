import { createGameTestHarness } from '@jimmyit/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { createButtonHeroGame } from './button-hero';

const notes = [{ lane: 0, atMs: 3_500 }, { lane: 1, atMs: 4_000 }];
const game = () => createButtonHeroGame({ notes });

describe('Button Hero', () => {
  it('judges lanes and timing, then saves the score', async () => {
    const h = await createGameTestHarness(game(), { toy: false });
    h.advance(3_500);
    h.run.submit({ type: 'button', lane: 1, pressed: true });
    expect(h.run.getScore().score).toBe(0);
    expect(h.run.getState().lastJudgment).toBe('tryAgain');
    h.run.submit({ type: 'button', lane: 0, pressed: true });
    h.run.submit({ type: 'button', lane: 0, pressed: true });
    expect(h.run.getState().perfect).toBe(1);
    expect(h.run.getState().combo).toBe(1);
    expect(h.run.getState().accuracyPercent).toBe(100);
    h.advance(610);
    h.run.submit({ type: 'button', lane: 1, pressed: true });
    expect(h.run.getState().good).toBe(1);
    expect(h.run.getState().combo).toBe(2);
    expect(await h.playToEnd()).toMatchObject({ score: 150, stars: 1,
      metrics: { perfectCount: 1, goodCount: 1, missCount: 0, accuracyPercent: 100 } });
  });

  it('ignores early presses and expires missed notes without reducing score', async () => {
    const h = await createGameTestHarness(game(), { toy: false });
    h.advance(3_000);
    h.run.submit({ type: 'button', lane: 0, pressed: true });
    h.advance(200);
    h.run.submit({ type: 'button', lane: 0, pressed: true });
    h.advance(501);
    expect(h.run.getState().misses).toBe(1);
    expect(h.run.getState().lastJudgment).toBe('miss');
    expect(h.run.getState().combo).toBe(0);
    expect(h.run.getScore().score).toBe(0);
    expect((await h.playToEnd()).completed).toBe(true);
  });

  it('starts a fresh run on replay', async () => {
    const first = await createGameTestHarness(game(), { toy: false });
    first.advance(3_500);
    first.run.submit({ type: 'button', lane: 0, pressed: true });
    await first.playToEnd();
    const replay = await createGameTestHarness(game(), { toy: false });
    expect(replay.run.getState().score).toBe(0);
    expect(replay.run.getState().resolved).toHaveLength(0);
  });

  it('keeps note timing aligned while paused', async () => {
    const h = await createGameTestHarness(game(), { toy: false });
    h.advance(3_000);
    h.run.pause();
    h.advance(2_000);
    expect(h.run.elapsedMs()).toBe(3_000);
    h.run.resume();
    h.advance(500);
    h.run.submit({ type: 'button', lane: 0, pressed: true });
    expect(h.run.getState().perfect).toBe(1);
  });
});
