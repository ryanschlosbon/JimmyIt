import { createGameTestHarness } from '@jimmyit/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { createTimedPractice } from './timed-practice';

describe('timed-motor-practice', () => {
  it('scores real toy moves of every kind', async () => {
    const h = await createGameTestHarness(createTimedPractice(30_000));
    h.fidget.tap('clicker');
    h.fidget.spin(180); // two 90° spins
    h.fidget.turnScrew(-3); // half a quarter turn: not a move yet
    h.fidget.turnScrew(-9); // 12 detents in all: two quarter turns
    h.fidget.press('sliderHigh');
    h.fidget.press('rocker');
    h.fidget.release('stylusStowed'); // stylus taken out of its bay
    h.fidget.press('stylusStowed'); // put back: not a move
    expect(h.run.getState()).toMatchObject({ totalMoves: 8, lastMove: 'stylus', score: 40 });

    const record = await h.playToEnd();
    expect(record).toMatchObject({
      gameId: 'timed-motor-practice',
      score: 40,
      actions: 8,
      stars: 1,
      completed: true,
      durationMs: 30_000,
      metrics: { buttonPressCount: 1, spinCount: 2, screwTurnCount: 2, slideCount: 1, rockerToggleCount: 1, stylusCount: 1 },
    });
  });

  it('gives partial credit for an attempt with no moves', async () => {
    const h = await createGameTestHarness(createTimedPractice(30_000));
    const record = await h.playToEnd();
    expect(record).toMatchObject({ score: 10, stars: 1, actions: 0 });
  });

  it('pauses without using time or counting moves, then resumes', async () => {
    const h = await createGameTestHarness(createTimedPractice(60_000));
    h.advance(10_000);
    h.fidget.tap('clicker');
    h.run.pause();
    h.advance(3_600_000);
    h.fidget.tap('clicker'); // ignored while paused
    expect(h.run.status).toBe('paused');
    expect(h.run.remainingMs()).toBe(50_000);
    h.run.resume();
    const record = await h.playToEnd(50_000);
    expect(record).toMatchObject({ durationMs: 60_000, metrics: { buttonPressCount: 1 } });
  });

  it('keeps effort when the child finishes early', async () => {
    const h = await createGameTestHarness(createTimedPractice(90_000));
    h.advance(1_200);
    h.fidget.tap('clicker');
    const record = await h.run.quit();
    expect(record).toMatchObject({ completed: false, durationMs: 1_200, score: 10, metrics: { buttonPressCount: 1 } });
  });
});
