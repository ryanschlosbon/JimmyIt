import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebShapeRecognizer, isShapeAIConfigured } from './shape-ai';

const drawing = { width: 100, height: 100,
  strokes: [[{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }, { x: 10, y: 10 }]],
};

afterEach(() => vi.unstubAllGlobals());

describe('web shape model adapter', () => {
  it('uses validated model output and falls back to local geometry when the proxy fails', async () => {
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      modelId: 'prithivMLmods/Geometric-Shapes-Classification', inferenceTimeMs: 12,
      labels: [{ label: 'square', score: 0.9 }, { label: 'circle', score: 0.1 }],
    }), { status: 200 })).mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);

    expect(isShapeAIConfigured()).toBe(true);
    const recognizer = createWebShapeRecognizer();
    const remote = await recognizer.predict(drawing, 'square');
    expect(remote.provider).toBe('huggingface');
    expect(remote.shape).toBe('square');
    expect(fetcher.mock.calls[0]?.[0]).toBe('/ai/shape/predict');
    expect(fetcher.mock.calls[0]?.[1].headers).toEqual({ 'Content-Type': 'application/json' });
    const local = await recognizer.predict(drawing, 'square');
    expect(local.algorithm).toBe('geometry-v1');
  });
});
