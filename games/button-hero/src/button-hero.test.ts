import { createGameTestHarness } from '@jimmyit/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { createButtonHeroGame, type ButtonHeroNote } from './button-hero';

const notes: readonly ButtonHeroNote[] = [
  { move: 'click', atMs: 3_500, holdMs: 0 },
  { move: 'left', atMs: 4_500, holdMs: 0 },
  { move: 'spin', atMs: 6_000, holdMs: 1_000 },
];
const game = () => createButtonHeroGame({ notes });

describe('Button Hero', () => {
  it('judges moves and timing, then saves the score', async () => {
    const h = await createGameTestHarness(game(), { toy: false });
    h.advance(3_500);
    h.run.submit({ type: 'button', move: 'left', pressed: true });
    expect(h.run.getScore().score).toBe(0);
    expect(h.run.getState().lastJudgment).toBe('tryAgain');
    h.run.submit({ type: 'button', move: 'click', pressed: true });
    h.run.submit({ type: 'button', move: 'click', pressed: true });
    expect(h.run.getState().perfect).toBe(1);
    expect(h.run.getState().combo).toBe(1);
    h.advance(1_250);
    h.run.submit({ type: 'button', move: 'left', pressed: true });
    expect(h.run.getState().good).toBe(1);
    expect(h.run.getState().combo).toBe(2);
    h.advance(1_250);
    h.run.submit({ type: 'button', move: 'spin', pressed: true });
    h.advance(1_000);
    h.run.submit({ type: 'button', move: 'spin', pressed: false });
    expect(await h.playToEnd()).toMatchObject({ score: 300, stars: 1,
      metrics: { perfectCount: 2, goodCount: 1, missCount: 0, accuracyPercent: 100 } });
  });

  it('is slow enough to read: notes on normal are seconds apart', () => {
    const state = (async () => (await createGameTestHarness(createButtonHeroGame(), { toy: false })).run.getState())();
    return state.then(({ notes: song, travelMs }) => {
      expect(travelMs).toBeGreaterThanOrEqual(5_000);
      song.slice(1).forEach((note, index) => {
        const previous = song[index];
        expect(note.atMs - (previous ? previous.atMs + previous.holdMs : 0)).toBeGreaterThanOrEqual(2_000);
      });
      expect(new Set(song.map(note => note.move))).toEqual(new Set(['click', 'left', 'right', 'spin']));
    });
  });

  it('gives partial credit for part of a spin riff', async () => {
    const h = await createGameTestHarness(game(), { toy: false });
    h.advance(6_000);
    h.run.submit({ type: 'button', move: 'spin', pressed: true });
    h.advance(400);
    h.run.submit({ type: 'button', move: 'spin', pressed: false });
    expect(h.run.getState().riffProgress[2]).toBeCloseTo(0.4);
    h.advance(700);
    expect(h.run.getState().lastJudgment).toBe('good');
    expect(h.run.getState().lastPoints).toBe(60);
  });

  it('plays with the real toy: clicker, nav keys and the spinner', async () => {
    const h = await createGameTestHarness(game());
    h.advance(3_500);
    h.fidget.tap('clicker');
    h.advance(1_000);
    h.fidget.tap('navLeft');
    expect(h.run.getState().perfect).toBe(2);
    h.advance(1_000);
    for (let i = 0; i < 12; i++) {
      h.fidget.spin(45);
      h.advance(100);
    }
    h.advance(400);
    expect(h.run.getState().riffProgress[2]).toBe(1);
    expect(h.run.getState().perfect).toBe(3);
  });

  it('expires missed notes without reducing score', async () => {
    const h = await createGameTestHarness(game(), { toy: false });
    h.advance(3_000);
    h.run.submit({ type: 'button', move: 'click', pressed: true });
    h.advance(900);
    expect(h.run.getState().misses).toBe(1);
    expect(h.run.getState().lastJudgment).toBe('miss');
    expect(h.run.getState().combo).toBe(0);
    expect(h.run.getScore().score).toBe(0);
    expect((await h.playToEnd()).completed).toBe(true);
  });

  it('starts a fresh run on replay', async () => {
    const first = await createGameTestHarness(game(), { toy: false });
    first.advance(3_500);
    first.run.submit({ type: 'button', move: 'click', pressed: true });
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
    h.run.submit({ type: 'button', move: 'click', pressed: true });
    expect(h.run.getState().perfect).toBe(1);
  });

  it('rejects songs where a press has a hold or a spin has none', () => {
    expect(() => createButtonHeroGame({ notes: [{ move: 'click', atMs: 4_000, holdMs: 500 }] })).toThrow();
    expect(() => createButtonHeroGame({ notes: [{ move: 'spin', atMs: 4_000, holdMs: 0 }] })).toThrow();
  });
});
