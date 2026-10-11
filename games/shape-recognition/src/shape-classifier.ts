export type Shape = 'circle' | 'triangle' | 'square' | 'rectangle' | 'unknown';
export type TargetShape = Exclude<Shape, 'unknown'>;
export type ShapeFeedback = 'shapeMatched' | 'keepTrying' | 'drawMore';

export interface DrawingPoint {
  readonly x: number;
  readonly y: number;
}

export interface ShapeDrawing {
  readonly width: number;
  readonly height: number;
  readonly strokes: readonly (readonly DrawingPoint[])[];
}

export interface ShapePrediction {
  readonly shape: Shape;
  /** Recognition strength from 0 to 1; it is not a calibrated probability. */
  readonly quality: number;
  readonly target: TargetShape | null;
  readonly matchesTarget: boolean | null;
  readonly feedback: ShapeFeedback;
  readonly algorithm: 'geometry-v1' | 'huggingface-siglip2';
  readonly provider?: 'geometry' | 'huggingface';
  readonly modelId?: string;
  readonly modelScore?: number;
  readonly inferenceTimeMs?: number;
}

export interface ShapeClassifier {
  classify(drawing: ShapeDrawing, target?: TargetShape): ShapePrediction;
}

export class ShapeDrawingError extends Error {
  override name = 'ShapeDrawingError';
}

const distance = (a: DrawingPoint, b: DrawingPoint): number => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a: DrawingPoint, b: DrawingPoint, c: DrawingPoint): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new ShapeDrawingError('drawing data is incomplete');
  return value;
}

function convexHull(points: readonly DrawingPoint[]): DrawingPoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: DrawingPoint[] = [];
  const upper: DrawingPoint[] = [];
  for (const point of sorted) {
    while (lower.length > 1 && cross(required(lower[lower.length - 2]), required(lower[lower.length - 1]), point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of sorted.reverse()) {
    while (upper.length > 1 && cross(required(upper[upper.length - 2]), required(upper[upper.length - 1]), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function polygonMetrics(points: readonly DrawingPoint[]): { area: number; perimeter: number } {
  let twiceArea = 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const a = required(points[i]);
    const b = required(points[(i + 1) % points.length]);
    twiceArea += a.x * b.y - b.x * a.y;
    perimeter += distance(a, b);
  }
  return { area: Math.abs(twiceArea) / 2, perimeter };
}

function pointToSegment(point: DrawingPoint, a: DrawingPoint, b: DrawingPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared);
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}

function simplifyHull(points: readonly DrawingPoint[], epsilon: number): DrawingPoint[] {
  const result = [...points];
  let changed = true;
  while (changed && result.length > 3) {
    changed = false;
    for (let i = 0; i < result.length; i++) {
      const previous = required(result[(i - 1 + result.length) % result.length]);
      const next = required(result[(i + 1) % result.length]);
      if (pointToSegment(required(result[i]), previous, next) < epsilon) {
        result.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return result;
}

function radialVariation(points: readonly DrawingPoint[]): number {
  const center = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
  const radii = points.map((p) => distance(p, center));
  const average = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  return average === 0 ? 1 : Math.sqrt(radii.reduce((sum, radius) => sum + (radius - average) ** 2, 0) / radii.length) / average;
}

function normalize(drawing: ShapeDrawing): { points: DrawingPoint[]; closure: number } {
  if (!Number.isFinite(drawing.width) || !Number.isFinite(drawing.height) || drawing.width <= 0 || drawing.height <= 0) {
    throw new ShapeDrawingError('canvas dimensions must be positive finite numbers');
  }
  if (!Array.isArray(drawing.strokes)) throw new ShapeDrawingError('strokes must be an array');
  if (drawing.strokes.length > 256) throw new ShapeDrawingError('drawing has too many strokes');
  const scale = Math.max(drawing.width, drawing.height);
  let pointCount = 0;
  const strokes = drawing.strokes.map((stroke) => {
    if (!Array.isArray(stroke)) throw new ShapeDrawingError('each stroke must be an array');
    pointCount += stroke.length;
    if (pointCount > 20_000) throw new ShapeDrawingError('drawing has too many points');
    return stroke.map((point) => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        throw new ShapeDrawingError('point coordinates must be finite numbers');
      }
      return { x: point.x / scale, y: point.y / scale };
    });
  }).filter((stroke) => stroke.length >= 2);
  const lengths = strokes.map((stroke) => stroke.slice(1).reduce((sum, point, index) => sum + distance(point, required(stroke[index])), 0));
  const longest = Math.max(0, ...lengths);
  const useful = strokes.filter((stroke, index) => required(lengths[index]) >= longest * 0.08);
  const points = useful.flatMap((stroke) => stroke.filter((point, index) => index === 0 || distance(point, required(stroke[index - 1])) > 0.002));
  const totalLength = useful.reduce((sum, stroke) =>
    sum + stroke.slice(1).reduce((part, point, index) => part + distance(point, required(stroke[index])), 0), 0);
  const onlyStroke = useful.length === 1 ? useful[0] : undefined;
  const endpointGap = onlyStroke && onlyStroke.length > 1
    ? distance(required(onlyStroke[0]), required(onlyStroke[onlyStroke.length - 1])) : 0;
  return { points, closure: totalLength === 0 ? 1 : endpointGap / totalLength };
}

/** Classifies touch strokes locally using geometric features, with no model or network access. */
export function createShapeClassifier(): ShapeClassifier {
  return {
    classify(drawing, target) {
      const { points, closure } = normalize(drawing);
      let shape: Shape = 'unknown';
      let quality = 0;
      if (points.length >= 3) {
        const hull = convexHull(points);
        if (hull.length >= 3) {
          const xs = points.map((point) => point.x);
          const ys = points.map((point) => point.y);
          const width = Math.max(...xs) - Math.min(...xs);
          const height = Math.max(...ys) - Math.min(...ys);
          const { area, perimeter } = polygonMetrics(hull);
          const aspect = Math.max(width, height) / Math.max(Math.min(width, height), 0.000001);
          const circularity = perimeter === 0 ? 0 : 4 * Math.PI * area / (perimeter * perimeter);
          const corners = simplifyHull(hull, perimeter * 0.025).length;
          const radial = radialVariation(hull);
          const fill = area / Math.max(width * height, 0.000001);
          if (width >= 0.03 && height >= 0.03 && area >= 0.0005 && closure < 0.38) {
            if (aspect < 1.4 && circularity >= 0.86 && radial < 0.22) {
              shape = 'circle';
              quality = clamp((circularity - 0.65) / 0.3) * clamp(1 - radial);
            } else if (corners === 3 && fill >= 0.35) {
              shape = 'triangle';
              quality = clamp((fill - 0.3) / 0.3);
            } else if (corners === 4 && fill >= 0.55) {
              shape = aspect <= 1.25 ? 'square' : aspect <= 3.5 ? 'rectangle' : 'unknown';
              quality = clamp((fill - 0.5) / 0.5) * (shape === 'square' ? clamp(1.5 - Math.abs(aspect - 1)) : 1);
            }
            quality = clamp(quality * clamp(1 - closure));
            if (quality < 0.35) shape = 'unknown';
          }
        }
      }
      const matchesTarget = target === undefined ? null : shape === target;
      return {
        shape,
        quality: Math.round(quality * 100) / 100,
        target: target ?? null,
        matchesTarget,
        feedback: shape === 'unknown' ? 'drawMore' : matchesTarget === false ? 'keepTrying' : 'shapeMatched',
        algorithm: 'geometry-v1',
        provider: 'geometry',
      };
    },
  };
}
