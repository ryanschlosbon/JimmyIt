export type Axis = 'horizontal' | 'vertical';
export interface KnobQuestAction { readonly type: 'axis'; readonly axis: Axis; readonly value: number; }
export interface KnobCalibration { readonly neutral?: number; readonly range?: number; readonly deadZone?: number; }

/** Normalize a calibrated analog position into an axis value from -1 to 1. */
export function analogToAxis(axis: Axis, raw: number, calibration: KnobCalibration = {}): KnobQuestAction {
  const neutral = calibration.neutral ?? 0.5;
  const range = calibration.range ?? 0.5;
  const deadZone = calibration.deadZone ?? 0.12;
  if (!Number.isFinite(raw) || !Number.isFinite(range) || range <= 0 || deadZone < 0 || deadZone >= 1) {
    throw new Error('invalid knob calibration');
  }
  const centered = Math.max(-1, Math.min(1, (raw - neutral) / range));
  const value = Math.abs(centered) <= deadZone ? 0
    : Math.sign(centered) * (Math.abs(centered) - deadZone) / (1 - deadZone);
  return { type: 'axis', axis, value };
}

/** Relative encoder steps yield a signed impulse. Hardware can call this for each notification. */
export function rotaryToAxis(axis: Axis, steps: number, stepsForFullSpeed = 3): KnobQuestAction {
  if (!Number.isFinite(steps) || !Number.isFinite(stepsForFullSpeed) || stepsForFullSpeed <= 0) {
    throw new Error('invalid rotary steps');
  }
  return { type: 'axis', axis, value: Math.max(-1, Math.min(1, steps / stepsForFullSpeed)) };
}

export function directionalToAxis(axis: Axis, negativeHeld: boolean, positiveHeld: boolean): KnobQuestAction {
  return { type: 'axis', axis, value: Number(positiveHeld) - Number(negativeHeld) };
}
