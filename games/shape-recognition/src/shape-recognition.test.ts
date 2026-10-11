import { createGameTestHarness } from '@jimmyit/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { createShapeRecognitionGame, type ShapeRecognitionAction } from './shape-recognition';
import type { ShapeDrawing } from './shape-classifier';

const square: ShapeDrawing = {
  width: 200, height: 200,
  strokes: [[
    { x: 20, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 180 }, { x: 20, y: 180 }, { x: 20, y: 20 },
  ]],
};
const triangle: ShapeDrawing = {
  width: 200, height: 200,
  strokes: [[{ x: 100, y: 20 }, { x: 180, y: 175 }, { x: 20, y: 175 }, { x: 100, y: 20 }]],
};
const submit = (submissionId: string, drawing: ShapeDrawing): ShapeRecognitionAction =>
  ({ type: 'submitDrawing', submissionId, drawing });

describe('shape recognition game', () => {
  it('selects targets, scores matches, and saves exactly one completed record', async () => {
    const h = await createGameTestHarness(createShapeRecognitionGame({ targets: ['square', 'triangle'] }));
    expect(h.run.getState().target).toBe('square');
    h.run.submit(submit('one', square));
    expect(h.run.getState()).toMatchObject({ target: 'triangle', matchedCount: 1, submissions: 1 });
    const firstScore = h.run.getScore().score;
    expect(firstScore).toBeGreaterThanOrEqual(20);
    h.run.submit(submit('two', triangle));
    expect(h.run.status).toBe('finished');
    const record = await h.run.result;
    expect(record).toMatchObject({
      gameId: 'shape-recognition', source: 'app', completed: true, actions: 2, stars: 3,
      metrics: { matchedShapes: 2, drawingSubmissions: 2 },
    });
    expect(record.score).toBeGreaterThan(firstScore);
    expect(await h.repository.list({ gameId: 'shape-recognition' })).toEqual([record]);
    expect(h.run.getState()).toMatchObject({ completed: true, target: null, matchedCount: 2 });
  });

  it('gives limited effort points without advancing and ignores duplicate IDs', async () => {
    const h = await createGameTestHarness(createShapeRecognitionGame({ targets: ['square'] }));
    h.run.submit(submit('wrong', triangle));
    expect(h.run.getScore().score).toBe(2);
    expect(h.run.getState()).toMatchObject({ target: 'square', submissions: 1, matchedCount: 0 });
    h.run.submit(submit('wrong', square));
    expect(h.run.getScore().score).toBe(2);
    expect(h.run.getState().submissions).toBe(1);
    h.run.submit(submit('another', triangle));
    expect(h.run.getScore().score).toBe(2);
    h.run.submit(submit('correct', square));
    const record = await h.run.result;
    expect(record.actions).toBe(3);
    expect(record.score).toBeGreaterThan(2);
    h.run.submit(submit('late', square));
    expect((await h.repository.list()).length).toBe(1);
  });

  it('saves an incomplete session through the runner when the child stops', async () => {
    const h = await createGameTestHarness(createShapeRecognitionGame({ targets: ['square'] }));
    h.run.submit(submit('attempt', triangle));
    h.advance(1_000);
    const record = await h.run.quit();
    expect(record).toMatchObject({ completed: false, score: 2, durationMs: 1_000, actions: 1 });
    expect(await h.repository.best('shape-recognition')).toEqual(record);
  });

  it('rejects invalid session targets and submission IDs', async () => {
    expect(() => createShapeRecognitionGame({ targets: [] })).toThrow(RangeError);
    const h = await createGameTestHarness(createShapeRecognitionGame({ targets: ['square'] }));
    expect(() => h.run.submit(submit('', square))).toThrow(RangeError);
    expect(h.run.getScore().score).toBe(0);
    await h.run.quit();
  });

  it('uses a supplied model result to score the existing shape challenge', async () => {
    const h = await createGameTestHarness(createShapeRecognitionGame({ targets: ['square'] }), { toy: false });
    h.run.submit({ type: 'submitDrawing', submissionId: 'model-one', drawing: square,
      prediction: { shape: 'square', quality: 0.8, target: 'triangle', matchesTarget: false,
        feedback: 'keepTrying', algorithm: 'huggingface-siglip2', provider: 'huggingface',
        modelId: 'prithivMLmods/Geometric-Shapes-Classification', modelScore: 0.8 },
    });
    const record = await h.run.result;
    expect(record.score).toBe(28);
    expect(h.run.getState().lastResult).toMatchObject({ provider: 'huggingface', matchesTarget: true });
    expect(await h.repository.list({ gameId: 'shape-recognition' })).toEqual([record]);
  });
});
