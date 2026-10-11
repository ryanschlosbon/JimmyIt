import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { createShapeInference, drawingToPng, parseShapeDrawing, validateShapeDrawing } from './shape-inference';

const drawing = { width: 1000, height: 650, strokes: [[
  { x: 500, y: 100 }, { x: 700, y: 325 }, { x: 500, y: 550 }, { x: 300, y: 325 }, { x: 500, y: 100 },
]] };

describe('Hugging Face shape inference', () => {
  it('validates only drawing coordinates and rasterizes to a centered 224-pixel PNG', () => {
    expect(() => parseShapeDrawing({ ...drawing, childName: 'Sam' })).toThrow(RangeError);
    expect(() => parseShapeDrawing({ ...drawing, strokes: [[{ x: Infinity, y: 0 }]] })).toThrow(RangeError);
    expect(() => parseShapeDrawing({ ...drawing, strokes: [[{ x: -1, y: 0 }]] })).toThrow(RangeError);
    const png = drawingToPng(parseShapeDrawing(drawing));
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.readUInt32BE(16)).toBe(224);
    expect(png.readUInt32BE(20)).toBe(224);
  });

  it('preserves a rectangle as wider than tall after centering', () => {
    const rectangle = { width: 1000, height: 650, strokes: [[
      { x: 200, y: 200 }, { x: 800, y: 200 }, { x: 800, y: 450 },
      { x: 200, y: 450 }, { x: 200, y: 200 },
    ]] };
    const png = drawingToPng(rectangle);
    const raw = inflateSync(png.subarray(41, 41 + png.readUInt32BE(33)));
    const occupied: { x: number; y: number }[] = [];
    for (let y = 0; y < 224; y++) for (let x = 0; x < 224; x++) {
      if (raw[y * 673 + 1 + x * 3] === 0) occupied.push({ x, y });
    }
    const xs = occupied.map((point) => point.x);
    const ys = occupied.map((point) => point.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan((Math.max(...ys) - Math.min(...ys)) * 2);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(112, 0);
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(112, 0);
  });

  it('rejects empty, dot, tiny, and straight marks while allowing imperfect and multi-stroke shapes', () => {
    const withStrokes = (strokes: typeof drawing.strokes): typeof drawing => ({ ...drawing, strokes });
    const rejected = [[], [[{ x: 500, y: 325 }]],
      [[{ x: 500, y: 325 }, { x: 502, y: 327 }, { x: 503, y: 325 }]],
      [[{ x: 280, y: 325 }, { x: 500, y: 325 }, { x: 720, y: 325 }]],
      [[{ x: 280, y: 180 }, { x: 500, y: 325 }, { x: 720, y: 470 }]],
      [[{ x: 280, y: 110 }, { x: 280, y: 550 }, { x: 720, y: 550 }, { x: 720, y: 110 }]],
    ];
    for (const strokes of rejected) expect(() => validateShapeDrawing(withStrokes(strokes))).toThrow(RangeError);
    const imperfect = withStrokes([[
      { x: 500, y: 115 }, { x: 760, y: 540 }, { x: 235, y: 555 }, { x: 485, y: 130 },
    ]]);
    const multiStroke = withStrokes([
      [{ x: 280, y: 110 }, { x: 720, y: 110 }], [{ x: 720, y: 110 }, { x: 720, y: 550 }],
      [{ x: 720, y: 550 }, { x: 280, y: 550 }], [{ x: 280, y: 550 }, { x: 280, y: 110 }],
    ]);
    expect(() => validateShapeDrawing(imperfect)).not.toThrow();
    expect(() => validateShapeDrawing(multiStroke)).not.toThrow();
  });

  it('sends only image bytes to the configured endpoint and retains genuine scores', async () => {
    let called = false;
    const fetcher: typeof fetch = async (input, init) => {
      called = true;
      expect(input).toBe('https://example.test/shape');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-key', 'Content-Type': 'image/png' });
      expect(init?.body).toBeInstanceOf(Uint8Array);
      return new Response(JSON.stringify([{ label: 'Circle ◯', score: 0.81 },
        { label: 'Triangle ▲', score: 0.19 }]), { status: 200 });
    };
    const inference = createShapeInference({ endpointUrl: 'https://example.test/shape', token: 'test-key', fetcher });
    expect(inference.isAvailable()).toBe(true);
    expect(await inference.predict(drawing)).toMatchObject({ labels: [
      { label: 'Circle ◯', score: 0.81 }, { label: 'Triangle ▲', score: 0.19 },
    ] });
    expect(called).toBe(true);
  });

  it('does not report ready without a secure configured endpoint', () => {
    expect(createShapeInference({}).isAvailable()).toBe(false);
    expect(createShapeInference({ endpointUrl: 'http://example.test', token: 'test-key' }).isAvailable()).toBe(false);
  });

  it('retries a cold-start gateway response without changing the private request', async () => {
    const calls: RequestInit[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      calls.push(init ?? {});
      if (calls.length < 3) return new Response('', { status: calls.length === 1 ? 502 : 503 });
      return new Response(JSON.stringify([{ label: 'Circle ◯', score: 0.9 }]), { status: 200 });
    };
    const inference = createShapeInference({ endpointUrl: 'https://example.test/shape', token: 'test-key',
      fetcher, retryDelayMs: 0 });
    expect((await inference.predict(drawing)).labels[0]).toMatchObject({ label: 'Circle ◯', score: 0.9 });
    expect(calls).toHaveLength(3);
    expect(calls[1]?.headers).toMatchObject({ Authorization: 'Bearer test-key' });
  });

  it('does not retry an authentication error or accept malformed model output', async () => {
    let calls = 0;
    const unauthorized: typeof fetch = async () => { calls++; return new Response('', { status: 401 }); };
    await expect(createShapeInference({ endpointUrl: 'https://example.test/shape', token: 'test-key',
      fetcher: unauthorized }).predict(drawing)).rejects.toThrow('shape model unavailable');
    expect(calls).toBe(1);
    const malformed: typeof fetch = async () => new Response(JSON.stringify([{ label: 'Circle', score: 4 }]));
    await expect(createShapeInference({ endpointUrl: 'https://example.test/shape', token: 'test-key',
      fetcher: malformed }).predict(drawing)).rejects.toThrow('invalid shape model response');
  });
});
