import { createShapeRecognizer, type ShapeDrawing, type ShapeModelAdapter, type ShapePrediction,
  type TargetShape } from '@jimmyit/game-shape-recognition';

const MODEL_ID = 'prithivMLmods/Geometric-Shapes-Classification';
const SHAPES = ['circle', 'triangle', 'square', 'rectangle'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serviceUrl(): string {
  const configured = import.meta.env.VITE_JIMMY_AI_URL?.replace(/\/$/, '') ?? '';
  if (configured && /^https:\/\/[^/]+/i.test(configured)) return configured;
  return import.meta.env.DEV ? '/ai' : '';
}

async function request(path: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const base = serviceUrl();
  if (!base) throw new Error('Shape AI service is not configured');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error('Shape AI service unavailable');
    return await response.json() as unknown;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function isShapeAIConfigured(): boolean {
  return serviceUrl().length > 0;
}

function decodeShape(label: string): TargetShape | 'unknown' {
  const first = label.trim().split(/\s+/)[0]?.toLowerCase();
  return SHAPES.find((shape) => shape === first) ?? 'unknown';
}

export function createWebShapeRecognizer() {
  const model: ShapeModelAdapter = {
    isReady: () => isShapeAIConfigured(),
    async predict(drawing: ShapeDrawing, target?: TargetShape): Promise<ShapePrediction> {
      const value = await request('/shape/predict', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawing }) }, 70_000);
      if (!isObject(value) || value.modelId !== MODEL_ID || !Array.isArray(value.labels) ||
        typeof value.inferenceTimeMs !== 'number' || !Number.isFinite(value.inferenceTimeMs)) {
        throw new Error('Invalid shape AI response');
      }
      const labels = value.labels;
      if (labels.length === 0 || labels.some((entry) => !isObject(entry) || typeof entry.label !== 'string' ||
        typeof entry.score !== 'number' || !Number.isFinite(entry.score) || entry.score < 0 || entry.score > 1)) {
        throw new Error('Invalid shape AI labels');
      }
      const ranked = [...labels].sort((a, b) => (b.score as number) - (a.score as number));
      const best = ranked[0] as { readonly label: string; readonly score: number };
      const shape = decodeShape(best.label);
      return {
        shape, quality: shape === 'unknown' ? 0 : best.score, target: target ?? null,
        matchesTarget: target === undefined ? null : shape === target,
        feedback: shape === 'unknown' ? 'drawMore' : shape === target ? 'shapeMatched' : 'keepTrying',
        algorithm: 'huggingface-siglip2', provider: 'huggingface', modelId: MODEL_ID,
        modelScore: best.score, inferenceTimeMs: value.inferenceTimeMs,
      };
    },
  };
  return createShapeRecognizer(model);
}
