import { describe, expect, it } from 'vitest';
import { createLocalActivityContentAdapter, createShapeRecognizer } from './adapters';

describe('optional adapters', () => {
  const drawing = {
    width: 100, height: 100,
    strokes: [[{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }, { x: 10, y: 10 }]],
  };

  it('uses local geometry when a trained model is not ready or throws', async () => {
    const unavailable = { isReady: () => false, predict: async () => { throw new Error('not loaded'); } };
    expect((await createShapeRecognizer(unavailable).predict(drawing)).shape).toBe('square');
    const broken = { isReady: () => true, predict: async () => { throw new Error('inference unavailable'); } };
    expect((await createShapeRecognizer(broken).predict(drawing)).algorithm).toBe('geometry-v1');
  });

  it('offers deterministic on-device instructions', async () => {
    expect(await createLocalActivityContentAdapter().generate({ theme: 'calm', target: 'circle' }))
      .toEqual({ instruction: 'Draw a circle at your own pace.', theme: 'calm', source: 'local' });
  });
});
