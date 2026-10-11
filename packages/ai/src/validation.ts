import type { AccessibilityPreferences, Difficulty, GameGenerationRequest, GeneratedLevel, InputControl } from './types';

const GAME_TYPES = ['tapQuest', 'shapeQuest', 'memoryQuest', 'reaction', 'calm'];
const CONTROLS: readonly InputControl[] = ['screenTouch', 'clicker', 'navLeft', 'navRight', 'spinner'];
const SHAPES = ['circle', 'square', 'rectangle', 'triangle'];
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isDifficulty = (value: unknown): value is Difficulty => Number.isInteger(value) && inRange(value, 1, 5);

export function validateGenerationRequest(request: GameGenerationRequest): void {
  if (!isObject(request) || !isObject(request.accessibilityPreferences)) {
    throw new RangeError('invalid generation request');
  }
  const preferences = request.accessibilityPreferences;
  if (!GAME_TYPES.includes(request.gameType) || !isDifficulty(request.difficulty) ||
    !isDifficulty(preferences.maximumDifficulty) || request.difficulty > preferences.maximumDifficulty ||
    typeof preferences.reducedMotion !== 'boolean' || typeof preferences.soundEnabled !== 'boolean' ||
    typeof preferences.untimed !== 'boolean' || typeof preferences.allowDistractions !== 'boolean' ||
    !inRange(preferences.minimumTargetRadius, 0.035, 0.18) ||
    typeof request.theme !== 'string' || request.theme.length > 30 || !/^[\w -]*$/.test(request.theme) ||
    !Array.isArray(request.availableInputControls) || request.availableInputControls.length === 0 ||
    request.availableInputControls.some((control) => !CONTROLS.includes(control)) ||
    (request.targetCount !== undefined && (!Number.isInteger(request.targetCount) ||
      !inRange(request.targetCount, 1, 12))) ||
    (request.variationSeed !== undefined && (!Number.isInteger(request.variationSeed) ||
      !inRange(request.variationSeed, 0, 0x7fffffff)))) {
    throw new RangeError('invalid generation request');
  }
  const screenGames = ['tapQuest', 'shapeQuest', 'calm'];
  if (screenGames.includes(request.gameType) && !request.availableInputControls.includes('screenTouch')) {
    throw new RangeError('screen touch is unavailable');
  }
  if (request.gameType === 'memoryQuest' &&
    !request.availableInputControls.some((control) =>
      ['screenTouch', 'clicker', 'navLeft', 'navRight'].includes(control))) {
    throw new RangeError('no sequence input is available');
  }
}

/** Rejects untrusted provider data; it never repairs an unsafe level. */
export function validateGeneratedLevel(
  value: unknown,
  request: GameGenerationRequest,
): GeneratedLevel {
  validateGenerationRequest(request);
  if (!isObject(value) || value.gameType !== request.gameType || !isDifficulty(value.difficulty) ||
    value.difficulty > request.difficulty || value.difficulty > request.accessibilityPreferences.maximumDifficulty ||
    typeof value.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(value.id) ||
    typeof value.title !== 'string' || !/^[\w ,.!'-]{1,50}$/.test(value.title) ||
    typeof value.instructions !== 'string' || !/^[\w ,.!'-]{1,120}$/.test(value.instructions) ||
    /\b(fail|wrong|lose|adhd|autis|diagnos)\b/i.test(value.instructions) ||
    value.theme !== request.theme || value.source !== 'local' ||
    !Array.isArray(value.targets) || !Array.isArray(value.sequence) ||
    !isObject(value.timing) || !isObject(value.sensory)) {
    throw new RangeError('invalid generated level');
  }
  const targets: readonly unknown[] = value.targets;
  const sequence: readonly unknown[] = value.sequence;
  if (targets.length > 12 || sequence.length > 12 ||
    (request.targetCount !== undefined &&
      (request.gameType === 'memoryQuest' ? sequence.length > request.targetCount : targets.length > request.targetCount)) ||
    (['tapQuest', 'shapeQuest', 'reaction', 'calm'].includes(request.gameType) && targets.length === 0) ||
    (request.gameType === 'memoryQuest' && sequence.length === 0) ||
    targets.some((target, index) => !isObject(target) || !inRange(target.radius, request.accessibilityPreferences.minimumTargetRadius, 0.2) ||
      !inRange(target.x, target.radius, 1 - target.radius) || !inRange(target.y, target.radius, 1 - target.radius) ||
      target.order !== index || (target.shape !== undefined && !SHAPES.includes(String(target.shape))) ||
      (request.gameType === 'shapeQuest' && !SHAPES.includes(String(target.shape)))) ||
    sequence.some((control) => !request.availableInputControls.includes(control as InputControl))) {
    throw new RangeError('invalid targets or sequence');
  }
  for (let i = 0; i < targets.length; i++) {
    const a = targets[i] as { x: number; y: number; radius: number };
    for (let j = i + 1; j < targets.length; j++) {
      const b = targets[j] as { x: number; y: number; radius: number };
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius + 0.015) {
        throw new RangeError('targets overlap');
      }
    }
  }
  const { responseWindowMs, activityDurationMs } = value.timing;
  if ((responseWindowMs !== null && !inRange(responseWindowMs, 500, 20_000)) ||
    (activityDurationMs !== null && !inRange(activityDurationMs, 5_000, 180_000)) ||
    (request.accessibilityPreferences.untimed && (responseWindowMs !== null || activityDurationMs !== null)) ||
    (request.gameType === 'calm' && (responseWindowMs !== null || activityDurationMs !== null)) ||
    typeof value.sensory.motion !== 'boolean' || typeof value.sensory.sound !== 'boolean' ||
    typeof value.sensory.distractions !== 'boolean' ||
    (request.accessibilityPreferences.reducedMotion && value.sensory.motion) ||
    (!request.accessibilityPreferences.soundEnabled && value.sensory.sound) ||
    (!request.accessibilityPreferences.allowDistractions && value.sensory.distractions)) {
    throw new RangeError('timing or sensory preferences violated');
  }
  return value as unknown as GeneratedLevel;
}

export function defaultAccessibilityPreferences(): AccessibilityPreferences {
  return { reducedMotion: true, soundEnabled: false, untimed: false,
    minimumTargetRadius: 0.055, maximumDifficulty: 5, allowDistractions: false };
}
