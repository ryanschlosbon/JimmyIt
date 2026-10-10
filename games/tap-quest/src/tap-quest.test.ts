import { createGameTestHarness } from '@jimmyit/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { recommendTapQuestDifficulty } from './adaptation';
import { distanceToPath, isCircleHit } from './geometry';
import { createTapQuestGame, type TapQuestAction } from './tap-quest';

function touch(point: { x: number; y: number }, phase: 'down' | 'move' | 'up' = 'down'): TapQuestAction {
  return { type: 'touch', phase, point };
}

describe('Tap Quest geometry and adaptation', () => {
  it('hits a circle and rejects a distant touch', () => {
    const target = { x: 0.5, y: 0.5, radius: 0.1 };
    expect(isCircleHit({ x: 0.5, y: 0.59 }, target)).toBe(true);
    expect(isCircleHit({ x: 0.7, y: 0.5 }, target)).toBe(false);
  });

  it('measures tolerance against straight and curved segments', () => {
    expect(distanceToPath({ x: 0.5, y: 0.08 }, [{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBeCloseTo(0.08);
    expect(distanceToPath({ x: 0.5, y: 0.5 }, [
      { x: 0, y: 0.5 }, { x: 0.5, y: 0.25 }, { x: 1, y: 0.5 },
    ])).toBeGreaterThan(0.2);
  });

  it('adapts deterministically using accuracy and completion, respecting the increase choice', () => {
    const strong = Array.from({ length: 3 }, () => ({ accuracy: 0.95, completionRate: 1 }));
    const ease = Array.from({ length: 3 }, () => ({ accuracy: 0.3, completionRate: 0.5 }));
    expect(recommendTapQuestDifficulty(2, strong).level).toBe(3);
    expect(recommendTapQuestDifficulty(2, strong, false).level).toBe(2);
    expect(recommendTapQuestDifficulty(2, ease).level).toBe(1);
    expect(recommendTapQuestDifficulty(2, []).level).toBe(2);
  });
});

describe('Tap Quest sessions', () => {
  it('scores precise and near-edge touches, ignores misses, and saves the completed record', async () => {
    const h = await createGameTestHarness(createTapQuestGame({ mode: 'precision', settings: { targetCount: 2 } }));
    const first = h.run.getState().target;
    expect(first).not.toBeNull();
    h.run.submit(touch({ x: 0.99, y: 0.99 }));
    expect(h.run.getScore().score).toBe(0);
    if (!first) throw new Error('target missing');
    h.run.submit(touch({ x: first.x + first.radius + 0.01, y: first.y }));
    expect(h.run.getScore().score).toBe(5);
    const second = h.run.getState().target;
    if (!second) throw new Error('second target missing');
    h.run.submit(touch(second));
    const record = await h.run.result;
    expect(record).toMatchObject({ gameId: 'tap-quest-precision', completed: true, score: 15, actions: 3,
      metrics: { matchedTargets: 2, touchAttempts: 3, completionPercent: 100 } });
    expect(await h.repository.best('tap-quest-precision')).toEqual(record);
    expect(await h.repository.list({ gameId: 'tap-quest-precision' })).toHaveLength(1);
  });

  it('expires targets after the configured timing window, with optional generous time', async () => {
    const game = createTapQuestGame({ mode: 'precision', settings: { targetCount: 1,
      targetDurationMs: 500, timingWindowMs: 300 } });
    const h = await createGameTestHarness(game);
    h.advance(700);
    expect(h.run.status).toBe('running');
    h.advance(100);
    expect((await h.run.result).score).toBe(0);
    const strict = await createGameTestHarness(createTapQuestGame({ mode: 'precision',
      settings: { targetCount: 1, targetDurationMs: 500, timingWindowMs: 300 },
      feedback: { generousTiming: false } }));
    strict.advance(500);
    expect(strict.run.status).toBe('finished');
  });

  it('traces sampled coordinates near the path and completes on sufficient coverage', async () => {
    const h = await createGameTestHarness(createTapQuestGame({ mode: 'trace', settings: { targetCount: 1 } }));
    h.run.submit(touch({ x: 0.9, y: 0.9 }));
    expect(h.run.getState().traceCoverage).toBe(0);
    const path = h.run.getState().path;
    path.slice(0, 5).forEach((point, i) => h.run.submit(touch(point, i === 0 ? 'down' : 'move')));
    expect((await h.run.result).score).toBe(10);
  });

  it('requires memory targets in order and supports mode-specific calm completion', async () => {
    const memory = await createGameTestHarness(createTapQuestGame({ mode: 'memory',
      settings: { sequenceLength: 2 } }));
    memory.run.submit(touch({ x: 0.99, y: 0.99 }));
    expect(memory.run.getState().targetIndex).toBe(0);
    expect(memory.run.getState().memoryPhase).toBe('preview');
    const sequence = memory.run.getState().sequence;
    memory.advance(1_800);
    expect(memory.run.getState().memoryPhase).toBe('recall');
    expect(memory.run.getState().target).toBeNull();
    expect(memory.run.getState().sequence).toEqual([]);
    const first = memory.run.getState().choices[sequence[0] ?? -1];
    if (!first) throw new Error('memory choice missing');
    memory.run.submit(touch(first));
    const second = memory.run.getState().choices[sequence[1] ?? -1];
    if (!second) throw new Error('memory choice missing');
    memory.run.submit(touch(second));
    expect((await memory.run.result).completed).toBe(true);

    const calm = await createGameTestHarness(createTapQuestGame({ mode: 'calm' }));
    calm.advance(20_000);
    expect(calm.run.status).toBe('running');
    const target = calm.run.getState().target;
    if (!target) throw new Error('calm target missing');
    calm.run.submit(touch(target));
    calm.run.submit({ type: 'finish' });
    expect((await calm.run.result).score).toBe(5);
  });

  it('pauses timing and restarts target progress while keeping earned points', async () => {
    const h = await createGameTestHarness(createTapQuestGame({ mode: 'precision', settings: {
      targetCount: 2, targetDurationMs: 500, timingWindowMs: 0,
    } }));
    const target = h.run.getState().target;
    if (!target) throw new Error('target missing');
    h.run.submit(touch(target));
    h.run.submit({ type: 'pause' });
    h.advance(2_000);
    expect(h.run.getState().targetIndex).toBe(1);
    h.run.submit({ type: 'resume' });
    h.run.submit({ type: 'restart' });
    expect(h.run.getState().targetIndex).toBe(0);
    expect(h.run.getScore().score).toBe(10);
    h.advance(1_000);
    expect((await h.run.result).metrics.restarts).toBe(1);
  });
});
