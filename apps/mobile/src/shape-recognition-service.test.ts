import { describe, expect, it } from 'vitest';
import { createShapeRecognizer } from '@jimmyit/game-shape-recognition';
import { createHuggingFaceShapeAdapter, createSessionShapeRecognizer, registerShapeKey,
  removeShapeKey } from './shape-recognition-service';

const drawing = { width: 100, height: 100, strokes: [[
  { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }, { x: 10, y: 10 },
]] };

describe('mobile shape recognition', () => {
  it('uses local geometry when no key is entered', async () => {
    expect(await createSessionShapeRecognizer().predict(drawing, 'square'))
      .toMatchObject({ shape: 'square', provider: 'geometry' });
  });
  it('returns the actual model label and score with provider metadata', async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      modelId: 'prithivMLmods/Geometric-Shapes-Classification', inferenceTimeMs: 42,
      labels: [{ label: 'Square ◾', score: 0.76 }, { label: 'Circle ◯', score: 0.24 }],
    }), { status: 200 });
    const result = await createHuggingFaceShapeAdapter('https://proxy.test', fetcher).predict(drawing, 'square');
    expect(result).toMatchObject({ shape: 'square', modelScore: 0.76,
      provider: 'huggingface', matchesTarget: true, inferenceTimeMs: 42 });
  });

  it('falls back to geometry after an unavailable endpoint', async () => {
    const fetcher: typeof fetch = async () => new Response('{}', { status: 503 });
    const result = await createShapeRecognizer(createHuggingFaceShapeAdapter('https://proxy.test', fetcher))
      .predict(drawing, 'square');
    expect(result).toMatchObject({ shape: 'square', provider: 'geometry', matchesTarget: true });
  });

  it('accepts HTTPS or loopback and keeps authentication errors and malformed replies out of model results', async () => {
    const unused: typeof fetch = async () => new Response('{}');
    expect(createHuggingFaceShapeAdapter('https://demo.example', unused).isReady()).toBe(true);
    expect(createHuggingFaceShapeAdapter('http://127.0.0.1:8787', unused).isReady()).toBe(true);
    expect(createHuggingFaceShapeAdapter('http://192.168.1.2:8787', unused).isReady()).toBe(false);
    for (const fetcher of [
      (async () => new Response('', { status: 401 })) as typeof fetch,
      (async () => new Response(JSON.stringify({ modelId: 'unexpected', labels: [] }))) as typeof fetch,
      (async () => { throw new DOMException('Timed out', 'AbortError'); }) as typeof fetch,
    ]) {
      const result = await createShapeRecognizer(createHuggingFaceShapeAdapter('https://demo.example', fetcher))
        .predict(drawing, 'square');
      expect(result).toMatchObject({ provider: 'geometry', shape: 'square' });
    }
  });
  it('registers a key without persisting it and sends only the proxy session with drawings', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      if (String(input).endsWith('/shape/session')) {
        return new Response(JSON.stringify({ token: 'temporary-session' }), { status: 200 });
      }
      return new Response(JSON.stringify({ modelId: 'prithivMLmods/Geometric-Shapes-Classification',
        inferenceTimeMs: 5, labels: [{ label: 'Square ◾', score: 0.8 }] }), { status: 200 });
    };
    const token = await registerShapeKey('test-secret-key', 'https://proxy.test', fetcher);
    await createHuggingFaceShapeAdapter('https://proxy.test', fetcher, token).predict(drawing, 'square');
    await removeShapeKey(token, 'https://proxy.test', fetcher);
    expect(requests.map((entry) => entry.url)).toEqual([
      'https://proxy.test/shape/session', 'https://proxy.test/shape/predict', 'https://proxy.test/shape/session',
    ]);
    expect(requests[0]?.init?.body).toBe(JSON.stringify({ apiKey: 'test-secret-key' }));
    expect((requests[1]?.init?.headers as Record<string, string>)['X-Shape-Session']).toBe(token);
    expect(String(requests[1]?.init?.body)).not.toContain('test-secret-key');
    expect((requests[2]?.init?.headers as Record<string, string>)['X-Shape-Session']).toBe(token);
    await expect(registerShapeKey('test-secret-key', 'http://192.168.1.2:8787', fetcher)).rejects.toThrow();
  });
});
