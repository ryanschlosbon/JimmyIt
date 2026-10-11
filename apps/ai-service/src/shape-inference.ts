import { deflateSync } from 'node:zlib';

export const SHAPE_MODEL_ID = 'prithivMLmods/Geometric-Shapes-Classification';

export interface ShapePoint { readonly x: number; readonly y: number }
export interface ShapeDrawing {
  readonly width: number;
  readonly height: number;
  readonly strokes: readonly (readonly ShapePoint[])[];
}

export interface ModelLabel { readonly label: string; readonly score: number }

const SIZE = 224;
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function chunk(name: string, data: Buffer): Buffer {
  const label = Buffer.from(name, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([label, data])) crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, label, data, checksum]);
}

export function parseShapeDrawing(value: unknown): ShapeDrawing {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RangeError('invalid drawing');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !['width', 'height', 'strokes'].includes(key)) ||
    typeof data.width !== 'number' || !Number.isFinite(data.width) || data.width <= 0 ||
    typeof data.height !== 'number' || !Number.isFinite(data.height) || data.height <= 0 ||
    !Array.isArray(data.strokes) || data.strokes.length > 256) throw new RangeError('invalid drawing');
  let count = 0;
  for (const stroke of data.strokes) {
    if (!Array.isArray(stroke)) throw new RangeError('invalid drawing');
    count += stroke.length;
    if (count > 20_000) throw new RangeError('invalid drawing');
    for (const point of stroke) {
      if (typeof point !== 'object' || point === null || Array.isArray(point) ||
        Object.keys(point).some((key) => !['x', 'y'].includes(key)) ||
        typeof point.x !== 'number' || !Number.isFinite(point.x) ||
        typeof point.y !== 'number' || !Number.isFinite(point.y) ||
        point.x < 0 || point.x > data.width || point.y < 0 || point.y > data.height) {
        throw new RangeError('invalid drawing');
      }
    }
  }
  return data as unknown as ShapeDrawing;
}

/** Rejects marks with too little area to be a shape without requiring a closed outline. */
export function validateShapeDrawing(drawing: ShapeDrawing): void {
  const points = drawing.strokes.flat();
  if (points.length < 3) throw new RangeError('drawing needs more detail');
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const canvasSize = Math.max(drawing.width, drawing.height);
  if (Math.max(width, height) < canvasSize * 0.02) throw new RangeError('drawing is too small');
  const pathLength = drawing.strokes.reduce((total, stroke) => total + stroke.slice(1).reduce((length, point, index) => {
    const previous = stroke[index];
    return length + (previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0);
  }, 0), 0);
  if (pathLength < canvasSize * 0.04) throw new RangeError('drawing needs more detail');
  const usefulStrokes = drawing.strokes.filter((stroke) => stroke.length >= 2);
  if (usefulStrokes.length === 1) {
    const stroke = usefulStrokes[0];
    const first = stroke?.[0];
    const last = stroke?.[stroke.length - 1];
    if (first && last && Math.hypot(first.x - last.x, first.y - last.y) / pathLength > 0.3) {
      throw new RangeError('drawing needs a fuller outline');
    }
  }
  const meanX = xs.reduce((sum, x) => sum + x, 0) / points.length;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / points.length;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  const trace = xx + yy;
  const discriminant = Math.sqrt((xx - yy) ** 2 + 4 * xy ** 2);
  const minor = (trace - discriminant) / 2;
  if (trace === 0 || minor / trace < 0.0004) throw new RangeError('drawing needs more area');
}

/** Centers the stroke bounds while keeping their aspect ratio; only pixels leave this service. */
export function drawingToPng(drawing: ShapeDrawing): Buffer {
  validateShapeDrawing(drawing);
  const points = drawing.strokes.flat();
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const extent = Math.max(maxX - minX, maxY - minY);
  if (extent < 1) throw new RangeError('drawing is blank');
  const scale = SIZE * 0.75 / extent;
  const offsetX = SIZE / 2 - (minX + maxX) * scale / 2;
  const offsetY = SIZE / 2 - (minY + maxY) * scale / 2;
  const pixels = Buffer.alloc(SIZE * SIZE * 3, 255);
  const dot = (x: number, y: number) => {
    const centerX = Math.round(x * scale + offsetX);
    const centerY = Math.round(y * scale + offsetY);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const px = centerX + dx;
      const py = centerY + dy;
      if (px < 0 || px >= SIZE || py < 0 || py >= SIZE || dx * dx + dy * dy > 4) continue;
      pixels.fill(0, (py * SIZE + px) * 3, (py * SIZE + px) * 3 + 3);
    }
  };
  for (const stroke of drawing.strokes) {
    for (let index = 1; index < stroke.length; index++) {
      const start = stroke[index - 1];
      const end = stroke[index];
      if (!start || !end) continue;
      const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) * scale));
      for (let step = 0; step <= steps; step++) {
        const fraction = step / steps;
        dot(start.x + (end.x - start.x) * fraction, start.y + (end.y - start.y) * fraction);
      }
    }
  }
  const raw = Buffer.alloc(SIZE * (1 + SIZE * 3));
  for (let row = 0; row < SIZE; row++) pixels.copy(raw, row * (1 + SIZE * 3) + 1, row * SIZE * 3, (row + 1) * SIZE * 3);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export interface ShapeInferenceOptions {
  readonly endpointUrl?: string;
  readonly token?: string;
  readonly fetcher?: typeof fetch;
  readonly coldStartWaitMs?: number;
  readonly retryDelayMs?: number;
}

export function createShapeInference(options: ShapeInferenceOptions) {
  const endpoint = options.endpointUrl;
  const available = Boolean(endpoint && options.token && /^https:\/\//.test(endpoint));
  return {
    isAvailable: () => available,
    async predict(drawing: ShapeDrawing): Promise<{ readonly labels: readonly ModelLabel[]; readonly inferenceTimeMs: number }> {
      if (!available || !endpoint || !options.token) throw new Error('shape model unavailable');
      const image = drawingToPng(drawing);
      const started = performance.now();
      const deadline = started + (options.coldStartWaitMs ?? 60_000);
      let response: Response;
      while (true) {
        const remainingMs = deadline - performance.now();
        if (remainingMs <= 0) throw new Error('shape model cold start timed out');
        response = await (options.fetcher ?? fetch)(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'image/png' },
          body: new Uint8Array(image),
          signal: AbortSignal.timeout(Math.max(1, Math.ceil(remainingMs))),
        });
        if (response.ok) break;
        if (response.status !== 502 && response.status !== 503) throw new Error('shape model unavailable');
        const waitMs = Math.min(options.retryDelayMs ?? 2_000, deadline - performance.now());
        if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
      const value: unknown = await response.json();
      if (!Array.isArray(value) || value.length === 0 || value.some((entry) =>
        typeof entry !== 'object' || entry === null || Array.isArray(entry) ||
        typeof entry.label !== 'string' || typeof entry.score !== 'number' ||
        !Number.isFinite(entry.score) || entry.score < 0 || entry.score > 1)) {
        throw new Error('invalid shape model response');
      }
      return { labels: value as ModelLabel[], inferenceTimeMs: Math.round(performance.now() - started) };
    },
  };
}
