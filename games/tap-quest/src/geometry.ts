export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Circle extends Point {
  readonly radius: number;
}

export function isCircleHit(point: Point, circle: Circle, extraRadius = 0): boolean {
  return Math.hypot(point.x - circle.x, point.y - circle.y) <= circle.radius + extraRadius;
}

export function distanceToPath(point: Point, path: readonly Point[]): number {
  if (path.length === 0) throw new RangeError('path needs at least one point');
  const first = path[0];
  if (!first) throw new RangeError('path needs at least one point');
  if (path.length === 1) return Math.hypot(point.x - first.x, point.y - first.y);
  let nearest = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    nearest = Math.min(nearest, Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)));
  }
  return nearest;
}
