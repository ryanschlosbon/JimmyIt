import { createShapeClassifier, type TargetShape } from '@jimmyit/game-shape-recognition';
import { createShapeInference, validateShapeDrawing, type ShapeDrawing } from './shape-inference';

const circle = Array.from({ length: 33 }, (_, index) => {
  const angle = index / 32 * Math.PI * 2;
  return { x: 500 + Math.cos(angle) * 180, y: 325 + Math.sin(angle) * 180 };
});
const imperfectCircle = Array.from({ length: 33 }, (_, index) => {
  const angle = index / 32 * Math.PI * 2;
  const radius = 180 + Math.sin(angle * 5) * 14;
  return { x: 500 + Math.cos(angle) * radius, y: 325 + Math.sin(angle) * radius };
});
const fixtures: readonly { readonly name: string; readonly expected: TargetShape | 'unknown';
  readonly strokes: ShapeDrawing['strokes'] }[] = [
  { name: 'circle', expected: 'circle', strokes: [circle] },
  { name: 'imperfect circle', expected: 'circle', strokes: [imperfectCircle] },
  { name: 'nearly closed circle', expected: 'circle', strokes: [circle.slice(1, 31)] },
  { name: 'triangle', expected: 'triangle', strokes: [[
    { x: 500, y: 100 }, { x: 760, y: 550 }, { x: 240, y: 550 }, { x: 500, y: 100 },
  ]] },
  { name: 'imperfect triangle', expected: 'triangle', strokes: [[
    { x: 490, y: 115 }, { x: 765, y: 540 }, { x: 235, y: 558 }, { x: 490, y: 115 },
  ]] },
  { name: 'square', expected: 'square', strokes: [[
    { x: 280, y: 110 }, { x: 720, y: 110 }, { x: 720, y: 550 }, { x: 280, y: 550 }, { x: 280, y: 110 },
  ]] },
  { name: 'imperfect square', expected: 'square', strokes: [[
    { x: 282, y: 115 }, { x: 715, y: 102 }, { x: 730, y: 548 }, { x: 268, y: 557 }, { x: 282, y: 115 },
  ]] },
  { name: 'tilted square', expected: 'square', strokes: [[
    { x: 500, y: 90 }, { x: 735, y: 325 }, { x: 500, y: 560 }, { x: 265, y: 325 }, { x: 500, y: 90 },
  ]] },
  { name: 'rectangle', expected: 'rectangle', strokes: [[
    { x: 200, y: 190 }, { x: 800, y: 190 }, { x: 800, y: 460 }, { x: 200, y: 460 }, { x: 200, y: 190 },
  ]] },
  { name: 'rough rectangle', expected: 'rectangle', strokes: [[
    { x: 205, y: 185 }, { x: 795, y: 195 }, { x: 810, y: 458 }, { x: 198, y: 470 }, { x: 210, y: 198 },
  ]] },
  { name: 'multi-stroke square', expected: 'square', strokes: [
    [{ x: 280, y: 110 }, { x: 720, y: 110 }], [{ x: 720, y: 110 }, { x: 720, y: 550 }],
    [{ x: 720, y: 550 }, { x: 280, y: 550 }], [{ x: 280, y: 550 }, { x: 280, y: 110 }],
  ] },
  { name: 'blank', expected: 'unknown', strokes: [] },
  { name: 'single dot', expected: 'unknown', strokes: [[{ x: 500, y: 325 }]] },
  { name: 'tiny mark', expected: 'unknown', strokes: [[
    { x: 500, y: 325 }, { x: 503, y: 327 }, { x: 506, y: 325 },
  ]] },
  { name: 'ambiguous line', expected: 'unknown', strokes: [[{ x: 280, y: 325 }, { x: 720, y: 325 }]] },
  { name: 'diagonal line', expected: 'unknown', strokes: [[
    { x: 280, y: 180 }, { x: 500, y: 325 }, { x: 720, y: 470 },
  ]] },
  { name: 'incomplete outline', expected: 'unknown', strokes: [[
    { x: 280, y: 110 }, { x: 280, y: 550 }, { x: 720, y: 550 }, { x: 720, y: 110 },
  ]] },
  { name: 'wrong target: square for circle', expected: 'square', strokes: [[
    { x: 280, y: 110 }, { x: 720, y: 110 }, { x: 720, y: 550 }, { x: 280, y: 550 }, { x: 280, y: 110 },
  ]] },
];

const proxyUrl = process.env.JIMMY_AI_PROXY_URL?.replace(/\/$/, '');
const inference = createShapeInference({ endpointUrl: process.env.HUGGING_FACE_ENDPOINT_URL,
  token: process.env.HUGGING_FACE_TOKEN });
if (!proxyUrl && !inference.isAvailable()) {
  throw new Error('Set JIMMY_AI_PROXY_URL, or set HUGGING_FACE_ENDPOINT_URL and HUGGING_FACE_TOKEN');
}

async function predict(drawing: ShapeDrawing) {
  if (!proxyUrl) return inference.predict(drawing);
  const response = await fetch(`${proxyUrl}/shape/predict`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drawing }) });
  if (!response.ok) throw new Error(`proxy HTTP ${response.status}`);
  const value: unknown = await response.json();
  if (typeof value !== 'object' || value === null || !('labels' in value) ||
    !Array.isArray(value.labels) || !('inferenceTimeMs' in value) ||
    typeof value.inferenceTimeMs !== 'number') throw new Error('invalid proxy response');
  return value as Awaited<ReturnType<typeof inference.predict>>;
}

const geometry = createShapeClassifier();
let modelCorrect = 0;
let geometryCorrect = 0;
let measured = 0;
let totalMs = 0;
let slowestMs = 0;
let failures = 0;
let invalidRejected = 0;
let validCount = 0;
for (const fixture of fixtures) {
  const drawing: ShapeDrawing = { width: 1000, height: 650, strokes: fixture.strokes };
  const local = geometry.classify(drawing).shape;
  const valid = fixture.expected !== 'unknown';
  if (valid) {
    validCount++;
    if (local === fixture.expected) geometryCorrect++;
  }
  let rejected = false;
  try { validateShapeDrawing(drawing); } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    rejected = true;
    if (!valid) invalidRejected++;
  }
  let model = 'unavailable';
  let duration = 'n/a';
  let score = 'n/a';
  let provider = 'none';
  if (rejected) {
    model = 'rejected';
    provider = 'validation';
  } else {
    try {
      const result = await predict(drawing);
      const top = [...result.labels].sort((a, b) => b.score - a.score)[0];
      model = top?.label.trim().split(/\s+/)[0]?.toLowerCase() ?? 'unknown';
      duration = String(result.inferenceTimeMs);
      score = top ? top.score.toFixed(3) : 'n/a';
      measured++;
      totalMs += result.inferenceTimeMs;
      slowestMs = Math.max(slowestMs, result.inferenceTimeMs);
      provider = 'huggingface';
      if (model === fixture.expected) modelCorrect++;
    } catch (error) {
      // A failed request is never counted as a model prediction.
      failures++;
      model = error instanceof Error ? `unavailable (${error.message})` : 'unavailable';
    }
  }
  process.stdout.write(`${fixture.name}: expected=${fixture.expected} model=${model} score=${score} ` +
    `provider=${provider} geometry=${local} modelMs=${duration} validationRejected=${rejected} fallback=false\n`);
}
process.stdout.write(`Valid synthetic shapes: model ${modelCorrect}/${measured} successful requests, ` +
  `geometry ${geometryCorrect}/${validCount}; invalid rejected ${invalidRejected}/${fixtures.length - validCount}; ` +
  `average model request: ${measured ? Math.round(totalMs / measured) : 'n/a'} ms ` +
  `slowest ${measured ? slowestMs : 'n/a'} ms (${measured} measured, ${failures} failed)\n`);
