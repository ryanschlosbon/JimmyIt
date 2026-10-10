import { describe, expect, it } from 'vitest';
import { createShapeClassifier, ShapeDrawingError, type DrawingPoint, type ShapeDrawing } from './shape-classifier';

const classifier = createShapeClassifier();
const draw = (strokes: readonly (readonly DrawingPoint[])[], size = 200): ShapeDrawing =>
  ({ width: size, height: size, strokes });
const closed = (points: readonly DrawingPoint[]): readonly DrawingPoint[] => {
  const first = points[0];
  if (!first) throw new RangeError('closed drawing needs a point');
  return [...points, first];
};

describe('shape classifier', () => {
  it('recognizes a circle across canvas sizes', () => {
    for (const size of [200, 1000]) {
      const points = Array.from({ length: 48 }, (_, index) => {
        const angle = index * Math.PI * 2 / 48;
        return { x: size / 2 + size * 0.3 * Math.cos(angle), y: size / 2 + size * 0.3 * Math.sin(angle) };
      });
      expect(classifier.classify(draw([closed(points)], size), 'circle')).toMatchObject({
        shape: 'circle', matchesTarget: true, algorithm: 'geometry-v1', feedback: 'shapeMatched',
      });
    }
  });

  it('accepts an imperfect circle with a small open gap', () => {
    const points = Array.from({ length: 40 }, (_, index) => {
      const angle = 0.2 + index * (Math.PI * 2 - 0.4) / 39;
      const radius = 60 + Math.sin(index * 5) * 2;
      return { x: 100 + radius * Math.cos(angle), y: 100 + radius * Math.sin(angle) };
    });
    expect(classifier.classify(draw([points]), 'circle').shape).toBe('circle');
  });

  it('recognizes separate strokes forming a slightly imperfect triangle', () => {
    const a = { x: 100, y: 20 }; const b = { x: 25, y: 165 }; const c = { x: 175, y: 160 };
    const result = classifier.classify(draw([[a, { x: 61, y: 94 }, b], [b, c], [c, a]]), 'square');
    expect(result.shape).toBe('triangle');
    expect(result.matchesTarget).toBe(false);
    expect(result.feedback).toBe('keepTrying');
  });

  it('distinguishes square and rectangle with open ends', () => {
    expect(classifier.classify(draw([[
      { x: 25, y: 25 }, { x: 175, y: 27 }, { x: 173, y: 175 }, { x: 26, y: 174 }, { x: 25, y: 35 },
    ]])).shape).toBe('square');
    expect(classifier.classify(draw([closed([
      { x: 15, y: 50 }, { x: 185, y: 50 }, { x: 185, y: 145 }, { x: 15, y: 145 },
    ])])).shape).toBe('rectangle');
  });

  it('returns unknown for empty, tiny, and ambiguous drawings', () => {
    expect(classifier.classify(draw([])).shape).toBe('unknown');
    expect(classifier.classify(draw([[{ x: 1, y: 1 }, { x: 2, y: 2 }]])).shape).toBe('unknown');
    expect(classifier.classify(draw([[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]])).shape).toBe('unknown');
  });

  it('ignores a short stray stroke and does not report a probability', () => {
    const result = classifier.classify(draw([
      closed([{ x: 25, y: 25 }, { x: 175, y: 25 }, { x: 175, y: 175 }, { x: 25, y: 175 }]),
      [{ x: 190, y: 190 }, { x: 192, y: 191 }],
    ]));
    expect(result.shape).toBe('square');
    expect(result.quality).toBeGreaterThan(0);
    expect(result.target).toBeNull();
    expect(result.matchesTarget).toBeNull();
  });

  it('rejects invalid dimensions and coordinates', () => {
    expect(() => classifier.classify(draw([], 0))).toThrow(ShapeDrawingError);
    expect(() => classifier.classify(draw([[{ x: Number.NaN, y: 0 }, { x: 1, y: 1 }]]))).toThrow(ShapeDrawingError);
  });
});
