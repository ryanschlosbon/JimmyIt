import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachDrawingInput } from './drawing-input.ts';

function pointer(type: string, pointerId: number, x: number, y: number): Event {
  return Object.assign(new Event(type, { cancelable: true }), { pointerId, clientX: x, clientY: y });
}

test('a stroke starts before any game session and continues outside the canvas', () => {
  const surface = new EventTarget();
  const dragTarget = new EventTarget();
  const points: string[] = [];
  const detach = attachDrawingInput(surface, dragTarget, (event) => ({ x: event.clientX, y: event.clientY }), {
    onStart: (point) => points.push(`start:${point.x},${point.y}`),
    onMove: (point) => points.push(`move:${point.x},${point.y}`),
    onEnd: (point) => points.push(`end:${point.x},${point.y}`),
  });
  surface.dispatchEvent(pointer('pointerdown', 1, 10, 20));
  dragTarget.dispatchEvent(pointer('pointermove', 1, 30, 40));
  dragTarget.dispatchEvent(pointer('pointerup', 1, 50, 60));
  assert.deepEqual(points, ['start:10,20', 'move:30,40', 'end:50,60']);
  detach();
});

test('other pointers cannot interrupt the active stroke', () => {
  const surface = new EventTarget();
  const dragTarget = new EventTarget();
  let starts = 0;
  let ends = 0;
  attachDrawingInput(surface, dragTarget, () => ({ x: 0, y: 0 }), {
    onStart: () => { starts++; },
    onMove: () => undefined,
    onEnd: () => { ends++; },
  });
  surface.dispatchEvent(pointer('pointerdown', 1, 0, 0));
  surface.dispatchEvent(pointer('pointerdown', 2, 0, 0));
  dragTarget.dispatchEvent(pointer('pointerup', 2, 0, 0));
  assert.equal(starts, 1);
  assert.equal(ends, 0);
  dragTarget.dispatchEvent(pointer('pointerup', 1, 0, 0));
  surface.dispatchEvent(pointer('pointerdown', 2, 0, 0));
  assert.equal(starts, 2);
});
