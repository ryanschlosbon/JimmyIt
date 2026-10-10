export interface Point { readonly x: number; readonly y: number }
export interface Stroke {
  readonly color: string;
  readonly width: number;
  readonly points: readonly Point[];
}
export type DrawingAction =
  | { readonly type: 'begin'; readonly point: Point; readonly color: string; readonly width: number }
  | { readonly type: 'move'; readonly point: Point }
  | { readonly type: 'undo' }
  | { readonly type: 'clear' };

/** Stores vector strokes (coordinates in the canvas’s own units) so resizing and switching themes never erase a drawing. */
export function drawingReducer(strokes: readonly Stroke[], action: DrawingAction): readonly Stroke[] {
  if (action.type === 'clear') return [];
  if (action.type === 'undo') return strokes.slice(0, -1);
  if (action.type === 'begin') return [...strokes, {
    color: action.color, width: action.width, points: [action.point],
  }];
  const last = strokes[strokes.length - 1];
  if (!last) return strokes;
  return [...strokes.slice(0, -1), { ...last, points: [...last.points, action.point] }];
}

export function strokeToPath(stroke: Stroke): string {
  const first = stroke.points[0];
  if (!first) return '';
  // A tiny segment makes single taps visible with round line caps.
  return `M ${first.x} ${first.y} ` + (stroke.points.length === 1
    ? `L ${first.x + 0.1} ${first.y}`
    : stroke.points.slice(1).map(point => `L ${point.x} ${point.y}`).join(' '));
}
