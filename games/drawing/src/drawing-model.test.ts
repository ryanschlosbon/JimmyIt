import { describe, expect, it } from 'vitest';
import { drawingReducer, strokeToPath, type Stroke } from './drawing-model';

describe('drawing strokes', () => {
  it('keeps earlier strokes immutable and undoes one whole stroke', () => {
    const first = drawingReducer([], { type: 'begin', color: '#3387D6', width: 10, point: { x: 10, y: 20 } });
    const moved = drawingReducer(first, { type: 'move', point: { x: 30, y: 40 } });
    const second = drawingReducer(moved, { type: 'begin', color: '#EF756D', width: 20, point: { x: 50, y: 60 } });
    expect(first[0]?.points).toHaveLength(1);
    expect(drawingReducer(second, { type: 'undo' })).toEqual(moved);
    expect(drawingReducer(second, { type: 'clear' })).toEqual([]);
    expect(drawingReducer([], { type: 'undo' })).toEqual([]);
    expect(drawingReducer([], { type: 'move', point: { x: 0, y: 0 } })).toEqual([]);
  });

  it('renders dots as well as continuous lines', () => {
    const stroke: Stroke = { color: '#3387D6', width: 10, points: [{ x: 10, y: 20 }] };
    expect(strokeToPath(stroke)).toBe('M 10 20 L 10.1 20');
    expect(strokeToPath({ ...stroke, points: [...stroke.points, { x: 30, y: 40 }] })).toBe('M 10 20 L 30 40');
  });
});
