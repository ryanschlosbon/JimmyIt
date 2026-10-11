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

describe('Tap Quest on a wide board', () => {
  it('spreads targets across the width and keeps circles round', async () => {
    const square = await createGameTestHarness(createTapQuestGame({ mode: 'calm' }), { toy: false });
    const wide = await createGameTestHarness(createTapQuestGame({ mode: 'calm', aspectRatio: 2 }), { toy: false });
    const a = square.run.getState().target;
    const b = wide.run.getState().target;
    expect(wide.run.getState().aspectRatio).toBe(2);
    expect(b?.x).toBeCloseTo((a?.x ?? 0) * 2);
    expect(b?.y).toBe(a?.y);
    expect(b?.radius).toBe(a?.radius);

    // A touch one radius to the right of the center, in board heights, still hits: the circle is round on screen.
    const target = b ?? { x: 0, y: 0, radius: 0 };
    wide.run.submit(touch({ x: (target.x + target.radius * 0.95) / 2, y: target.y }));
    expect(wide.run.getState().matchedCount).toBe(1);
  });

  it('misses a touch that is a radius away in board widths but not in heights', async () => {
    const wide = await createGameTestHarness(createTapQuestGame({ mode: 'calm', aspectRatio: 2 }), { toy: false });
    const target = wide.run.getState().target ?? { x: 0, y: 0, radius: 0 };
    wide.run.submit(touch({ x: target.x / 2 + target.radius * 1.5, y: target.y })); // 3 radii away on screen
    expect(wide.run.getState().matchedCount).toBe(0);
  });

  it('stretches trace paths sideways and rejects impossible shapes', async () => {
    const square = await createGameTestHarness(createTapQuestGame({ mode: 'trace', patternSeed: 3 }), { toy: false });
    const wide = await createGameTestHarness(createTapQuestGame({ mode: 'trace', patternSeed: 3, aspectRatio: 1.6 }),
      { toy: false });
    const xs = (points: readonly { x: number }[]) => points.map(point => point.x);
    expect(xs(wide.run.getState().path)).toEqual(xs(square.run.getState().path).map(x => x * 1.6));
    expect(() => createTapQuestGame({ mode: 'calm', aspectRatio: 0.5 })).toThrow(RangeError);
    expect(() => createTapQuestGame({ mode: 'calm', aspectRatio: 3 })).toThrow(RangeError);
  });
});

describe('Tap Quest sessions', () => {
  it('varies all four mode patterns between plays with reproducible seeds', async () => {
    for (const mode of ['precision', 'calm', 'trace', 'memory'] as const) {
      const first = await createGameTestHarness(createTapQuestGame({ mode, patternSeed: 101 }), { toy: false });
      const second = await createGameTestHarness(createTapQuestGame({ mode, patternSeed: 102 }), { toy: false });
      const repeat = await createGameTestHarness(createTapQuestGame({ mode, patternSeed: 101 }), { toy: false });
      const pattern = (state: ReturnType<typeof first.run.getState>) => mode === 'trace' ? state.path
        : mode === 'memory' ? state.sequence : state.target;
      expect(pattern(first.run.getState())).not.toEqual(pattern(second.run.getState()));
      expect(pattern(first.run.getState())).toEqual(pattern(repeat.run.getState()));
    }
  });

  it('uses a validated generated layout for circle modes', async () => {
    const points = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }] as const;
    const precision = await createGameTestHarness(createTapQuestGame({ mode: 'precision', patternPositions: points }),
      { toy: false });
    expect(precision.run.getState().target).toMatchObject(points[0]);
    const memory = await createGameTestHarness(createTapQuestGame({ mode: 'memory', patternPositions: points }),
      { toy: false });
    expect(memory.run.getState().choices.map(({ x, y }) => ({ x, y }))).toEqual(points);
    expect(() => createTapQuestGame({ mode: 'precision', patternPositions: [points[0], points[0],
      points[2], points[3]] })).toThrow('overlap');
  });
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

  it('cycles through eight trace shapes at varied positions inside the play area', async () => {
    const h = await createGameTestHarness(createTapQuestGame({ mode: 'trace', patternSeed: 101,
      settings: { targetCount: 8 } }), { toy: false });
    const shapes = new Set<string>();
    const centers = new Set<string>();
    for (let target = 0; target < 8; target++) {
      const path = h.run.getState().path;
      expect(path).toHaveLength(7);
      expect(path.every(({ x, y }) => x >= 0.12 && x <= 0.88 && y >= 0.12 && y <= 0.88)).toBe(true);
      const first = path[0];
      if (!first) throw new Error('trace path missing');
      shapes.add(JSON.stringify(path.map(({ x, y }) => [Math.round((x - first.x) * 100),
        Math.round((y - first.y) * 100)])));
      centers.add(`${Math.round(path.reduce((sum, point) => sum + point.x, 0) * 100 / path.length)},` +
        `${Math.round(path.reduce((sum, point) => sum + point.y, 0) * 100 / path.length)}`);
      path.slice(0, 5).forEach((point, index) => h.run.submit(touch(point, index === 0 ? 'down' : 'move')));
    }
    expect(shapes.size).toBe(8);
    expect(centers.size).toBeGreaterThan(3);
    expect((await h.run.result).score).toBe(80);
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
