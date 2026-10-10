// Tap Quest with the shared pieces around it: screen-only play, the runner's
// pause, and score moments reaching the app and the toy.
import type { ScoreEvent } from '@jimmyit/game-sdk';
import { createGameTestHarness } from '@jimmyit/game-sdk/testing';
import { describe, expect, it, vi } from 'vitest';
import { createTapQuestGame, type TapQuestAction } from './tap-quest';

const tap = (point: { x: number; y: number }): TapQuestAction => ({ type: 'touch', phase: 'down', point });

describe('Tap Quest with the app and the toy', () => {
  it('is a screen game: plays and saves with no toy connected', async () => {
    const game = createTapQuestGame({ mode: 'precision', settings: { targetCount: 1 } });
    expect(game.needsToy).toBe(false);
    const h = await createGameTestHarness(game, { toy: false });
    const target = h.run.getState().target;
    if (!target) throw new Error('target missing');
    h.run.submit(tap(target));
    expect(await h.run.result).toMatchObject({ gameId: 'tap-quest-precision', deviceId: null, score: 10 });
  });

  it('sends its score moments to the app and the toy, with a milestone at 100', async () => {
    const h = await createGameTestHarness(createTapQuestGame({ mode: 'calm' }));
    const events: ScoreEvent[] = [];
    h.run.onScoreEvent((event) => events.push(event));
    await vi.waitFor(() => expect(events[0]?.kind).toBe('gameStart'));
    for (let i = 0; i < 20; i++) {
      const target = h.run.getState().target;
      if (!target) throw new Error('calm target missing');
      h.run.submit(tap(target)); // +5 each
      h.advance(200); // spaced out, so the toy gets each one
    }
    h.run.submit({ type: 'finish' });
    await h.run.result;

    expect(events.filter((e) => e.kind === 'points')).toHaveLength(20);
    expect(events.filter((e) => e.kind !== 'points').map((e) => [e.kind, e.score])).toEqual([
      ['gameStart', 0],
      ['milestone', 100],
      ['gameEnd', 100],
    ]);
    // The toy celebrated the same moments (animation + haptic on the real toy)…
    expect(h.fidget.scoreEvents.map((e) => e.kind)).toContain('milestone');
    expect(h.fidget.lastCelebration).toMatchObject({ kind: 'gameEnd', score: 100, source: 'app' });
    // …and showed the result, without an extra end haptic from the app.
    expect(h.fidget.display.score).toMatchObject({ score: 100 });
    expect(h.fidget.haptics).toEqual([]);
  });

  it('freezes target timing while the app pauses the run (e.g. the app goes to the background)', async () => {
    const h = await createGameTestHarness(createTapQuestGame({
      mode: 'precision',
      settings: { targetCount: 2, targetDurationMs: 500, timingWindowMs: 0 },
    }));
    h.run.pause();
    h.advance(10_000);
    h.run.resume();
    expect(h.run.getState().targetIndex).toBe(0); // nothing expired while paused
    h.advance(500);
    expect(h.run.getState().targetIndex).toBe(1);
  });
});
