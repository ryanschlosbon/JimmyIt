export interface InputPoint {
  readonly x: number;
  readonly y: number;
}

export interface DrawingInputHandlers {
  onStart(point: InputPoint): void;
  onMove(point: InputPoint): void;
  onEnd(point: InputPoint): void;
}

/** Keeps drawing input independent of game startup and pointer-capture support. */
export function attachDrawingInput(
  surface: EventTarget,
  dragTarget: EventTarget,
  pointFor: (event: PointerEvent) => InputPoint,
  handlers: DrawingInputHandlers,
): () => void {
  let activePointerId: number | null = null;
  const onDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (activePointerId !== null) return;
    event.preventDefault();
    activePointerId = pointer.pointerId;
    handlers.onStart(pointFor(pointer));
  };
  const onMove = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (activePointerId !== pointer.pointerId) return;
    event.preventDefault();
    handlers.onMove(pointFor(pointer));
  };
  const onEnd = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (activePointerId !== pointer.pointerId) return;
    event.preventDefault();
    activePointerId = null;
    handlers.onEnd(pointFor(pointer));
  };
  surface.addEventListener('pointerdown', onDown);
  dragTarget.addEventListener('pointermove', onMove);
  dragTarget.addEventListener('pointerup', onEnd);
  dragTarget.addEventListener('pointercancel', onEnd);
  return () => {
    surface.removeEventListener('pointerdown', onDown);
    dragTarget.removeEventListener('pointermove', onMove);
    dragTarget.removeEventListener('pointerup', onEnd);
    dragTarget.removeEventListener('pointercancel', onEnd);
  };
}
