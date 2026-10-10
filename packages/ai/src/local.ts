import type { AIProvider, GameGenerationRequest, GeneratedLevel, GeneratedTarget, InputControl } from './types';
import { validateGeneratedLevel, validateGenerationRequest } from './validation';

const SHAPES = ['circle', 'square', 'rectangle', 'triangle'] as const;
const INSTRUCTIONS = {
  tapQuest: 'Tap each circle in order.',
  shapeQuest: 'Find each shape at your own pace.',
  memoryQuest: 'Watch the pattern, then try it.',
  reaction: 'Tap the next target when it appears.',
  calm: 'Explore the circles at your own pace.',
} as const;
const TITLES = { tapQuest: 'Tap Quest', shapeQuest: 'Shape Quest',
  memoryQuest: 'Memory Quest', reaction: 'Reaction', calm: 'Calm' } as const;

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Generates a repeatable level for a given seed; no history or network is used. */
export function generateLocalLevel(request: GameGenerationRequest): GeneratedLevel {
  validateGenerationRequest(request);
  const radius = Math.max(request.accessibilityPreferences.minimumTargetRadius, 0.11 - request.difficulty * 0.008);
  const columns = radius > 0.13 ? 2 : 3;
  const rows = columns;
  const count = Math.min(request.targetCount ?? 2 + request.difficulty, columns * rows);
  const random = request.variationSeed === undefined ? null : createRandom(request.variationSeed);
  const slots = Array.from({ length: columns * rows }, (_, index) => index);
  if (random) {
    for (let index = slots.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1));
      [slots[index], slots[swap]] = [slots[swap] ?? index, slots[index] ?? swap];
    }
  }
  const targets: GeneratedTarget[] = [];
  if (request.gameType !== 'memoryQuest') {
    for (let index = 0; index < count; index++) {
      const slot = slots[index] ?? index;
      const column = slot % columns;
      const row = Math.floor(slot / columns);
      const jitter = columns === 2 ? 0.04 : 0.015;
      targets.push({ x: (column + 0.5) / columns + (random ? (random() * 2 - 1) * jitter : 0),
        y: (row + 0.5) / rows + (random ? (random() * 2 - 1) * jitter : 0),
        radius, order: index, ...(request.gameType === 'shapeQuest' ? { shape: SHAPES[index % SHAPES.length] } : {}) });
    }
  }
  const available = request.availableInputControls.filter((control) => control !== 'spinner');
  const inputs: readonly InputControl[] = available.length > 0 ? available : request.availableInputControls;
  const sequence = request.gameType === 'memoryQuest'
    ? Array.from({ length: Math.min(request.targetCount ?? request.difficulty + 2, 12) },
      (_, index) => inputs[index % inputs.length] ?? inputs[0] ?? 'clicker') : [];
  const untimed = request.accessibilityPreferences.untimed || request.gameType === 'calm';
  const level: GeneratedLevel = {
    id: `local-${request.gameType.toLowerCase()}-${request.difficulty}-${count}` +
      (request.variationSeed === undefined ? '' : `-${request.variationSeed.toString(36)}`),
    title: `${TITLES[request.gameType]} activity`,
    instructions: INSTRUCTIONS[request.gameType], gameType: request.gameType,
    difficulty: request.difficulty, targets, sequence, theme: request.theme,
    timing: { responseWindowMs: untimed ? null : 4_000 - request.difficulty * 300,
      activityDurationMs: untimed ? null : 30_000 + request.difficulty * 10_000 },
    sensory: { motion: !request.accessibilityPreferences.reducedMotion,
      sound: request.accessibilityPreferences.soundEnabled, distractions: false },
    source: 'local',
  };
  return validateGeneratedLevel(level, request);
}

export function createLocalProvider(): AIProvider {
  return { name: 'local', isAvailable: async () => true,
    generate: async (request) => generateLocalLevel(request), testConnection: async () => true };
}
