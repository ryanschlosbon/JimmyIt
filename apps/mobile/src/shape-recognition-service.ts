import { createShapeRecognizer, type ShapeDrawing, type ShapeModelAdapter, type ShapePrediction,
  type TargetShape, type Shape } from '@jimmyit/game-shape-recognition';

const MODEL_ID = 'prithivMLmods/Geometric-Shapes-Classification';
const serviceUrl = process.env.EXPO_PUBLIC_JIMMY_AI_URL?.replace(/\/$/, '') ?? '';
const supported: readonly Shape[] = ['circle', 'triangle', 'square', 'rectangle'];

function trustedServiceUrl(url: string): string {
  const baseUrl = url.replace(/\/$/, '');
  if (/^https:\/\/[^/]+/i.test(baseUrl) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl)) {
    return baseUrl;
  }
  throw new Error('Shape AI service needs HTTPS or localhost');
}

/** Exchanges a Hugging Face key for a short-lived proxy session; the key is never stored on the phone. */
export async function registerShapeKey(apiKey: string, url = serviceUrl, fetcher: typeof fetch = fetch): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  let response: Response;
  try {
    response = await fetcher(`${trustedServiceUrl(url)}/shape/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }),
      signal: controller.signal,
    });
  } finally { clearTimeout(timeout); }
  if (!response.ok) throw new Error('Shape AI service unavailable');
  const value: unknown = await response.json();
  if (!isObject(value) || typeof value.token !== 'string') throw new Error('Invalid shape AI session');
  return value.token;
}

export async function removeShapeKey(sessionToken: string, url = serviceUrl, fetcher: typeof fetch = fetch): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  let response: Response;
  try {
    response = await fetcher(`${trustedServiceUrl(url)}/shape/session`, {
      method: 'DELETE', headers: { 'X-Shape-Session': sessionToken }, signal: controller.signal,
    });
  } finally { clearTimeout(timeout); }
  if (!response.ok) throw new Error('Shape AI service unavailable');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeShape(label: string): Shape {
  const name = label.trim().split(/\s+/)[0]?.toLowerCase();
  return supported.find((shape) => shape === name) ?? 'unknown';
}

/** Uses real endpoint scores; a model error is handled by createShapeRecognizer's geometry fallback. */
export function createHuggingFaceShapeAdapter(url = serviceUrl, fetcher: typeof fetch = fetch,
  sessionToken?: string): ShapeModelAdapter {
  const baseUrl = url.replace(/\/$/, '');
  const secureUrl = /^https:\/\/[^/]+/i.test(baseUrl);
  const localUrl = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl);
  return {
    isReady: () => secureUrl || localUrl,
    async predict(drawing: ShapeDrawing, target?: TargetShape): Promise<ShapePrediction> {
      if (drawing.strokes.flat().length < 2) throw new Error('blank drawing');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 70_000);
      try {
        const response = await fetcher(`${baseUrl}/shape/predict`, {
          method: 'POST', headers: { 'Content-Type': 'application/json',
            ...(sessionToken ? { 'X-Shape-Session': sessionToken } : {}) },
          body: JSON.stringify({ drawing }), signal: controller.signal,
        });
        if (!response.ok) throw new Error('shape model unavailable');
        const value: unknown = await response.json();
        if (!isObject(value) || value.modelId !== MODEL_ID || !Array.isArray(value.labels) ||
          typeof value.inferenceTimeMs !== 'number' || !Number.isFinite(value.inferenceTimeMs)) {
          throw new Error('invalid shape model response');
        }
        const labels = value.labels;
        if (labels.length === 0 || labels.some((entry) => !isObject(entry) ||
          typeof entry.label !== 'string' || typeof entry.score !== 'number' ||
          !Number.isFinite(entry.score) || entry.score < 0 || entry.score > 1)) {
          throw new Error('invalid shape model labels');
        }
        const ranked = [...labels].sort((a, b) => (b.score as number) - (a.score as number));
        const top = ranked[0] as { label: string; score: number };
        const shape = decodeShape(top.label);
        const matchesTarget = target === undefined ? null : shape === target;
        const prediction: ShapePrediction = {
          shape, quality: shape === 'unknown' ? 0 : top.score,
          target: target ?? null, matchesTarget,
          feedback: shape === 'unknown' ? 'drawMore' : matchesTarget === false ? 'keepTrying' : 'shapeMatched',
          algorithm: 'huggingface-siglip2', provider: 'huggingface', modelId: MODEL_ID,
          modelScore: top.score, inferenceTimeMs: value.inferenceTimeMs,
        };
        return prediction;
      } finally { clearTimeout(timeout); }
    },
  };
}

export function createSessionShapeRecognizer(sessionToken?: string) {
  return createShapeRecognizer(sessionToken
    ? createHuggingFaceShapeAdapter(serviceUrl, fetch, sessionToken) : undefined);
}
