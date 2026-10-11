import { describe, expect, it } from 'vitest';
import { createLocalProvider, generateLocalLevel } from './local';
import { getPersonalizationRecommendation } from './personalization';
import { createAIService } from './service';
import type { GameGenerationRequest, RoundMetrics } from './types';
import { defaultAccessibilityPreferences, validateGeneratedLevel, validateGenerationRequest } from './validation';

const preferences = defaultAccessibilityPreferences();
const request: GameGenerationRequest = { gameType: 'tapQuest', theme: 'garden', difficulty: 2,
  accessibilityPreferences: preferences, availableInputControls: ['screenTouch'], targetCount: 4 };
const round = (accuracy: number): RoundMetrics => ({ accuracy, completionRate: accuracy,
  successfulInputs: Math.round(accuracy * 10), incorrectInputs: Math.round((1 - accuracy) * 10) });

describe('local generation', () => {
  it('changes Tap Quest layouts across seeds while remaining repeatable and valid', () => {
    const first = generateLocalLevel({ ...request, variationSeed: 101 });
    const second = generateLocalLevel({ ...request, variationSeed: 102 });
    expect(first.targets).not.toEqual(second.targets);
    expect(first).toEqual(generateLocalLevel({ ...request, variationSeed: 101 }));
    expect(() => validateGeneratedLevel(first, { ...request, variationSeed: 101 })).not.toThrow();
    expect(() => validateGenerationRequest({ ...request, variationSeed: -1 })).toThrow();
  });
  it('creates repeatable levels for every supported activity', () => {
    for (const gameType of ['tapQuest', 'shapeQuest', 'memoryQuest', 'reaction', 'calm'] as const) {
      const controls = gameType === 'memoryQuest' ? ['clicker'] as const : ['screenTouch'] as const;
      const input = { ...request, gameType, availableInputControls: controls };
      expect(generateLocalLevel(input)).toEqual(generateLocalLevel(input));
    }
  });

  it('uses only available controls and respects untimed, quiet, low motion preferences', () => {
    const memory = generateLocalLevel({ ...request, gameType: 'memoryQuest',
      availableInputControls: ['clicker'], accessibilityPreferences: { ...preferences, untimed: true } });
    expect(memory.sequence.every((item) => item === 'clicker')).toBe(true);
    expect(memory.timing).toEqual({ responseWindowMs: null, activityDurationMs: null });
    expect(memory.sensory).toEqual({ motion: false, sound: false, distractions: false });
    expect(generateLocalLevel({ ...request, gameType: 'calm' }).timing.activityDurationMs).toBeNull();
  });

  it('rejects unavailable controls and unsafe provider output', () => {
    expect(() => validateGenerationRequest({ ...request, availableInputControls: ['clicker'] })).toThrow();
    expect(() => validateGenerationRequest({ ...request, gameType: 'memoryQuest',
      availableInputControls: ['spinner'] })).toThrow();
    const good = generateLocalLevel(request);
    expect(() => validateGeneratedLevel({ ...good, targets: [{ ...good.targets[0], x: 1.4 }] }, request)).toThrow();
    expect(() => validateGeneratedLevel({ ...good, sequence: ['navRight'] }, request)).toThrow();
    expect(() => validateGeneratedLevel({ ...good, targets: [...good.targets, ...good.targets] }, request)).toThrow();
    expect(() => validateGeneratedLevel({ ...good, sensory: { ...good.sensory, sound: true } }, request)).toThrow();
    expect(() => validateGeneratedLevel({ ...good, instructions: 'You are wrong.' }, request)).toThrow();
  });

  it('rejects overlong sequences and target sizes below the accessibility minimum', () => {
    const good = generateLocalLevel(request);
    expect(() => validateGeneratedLevel({ ...good, sequence: Array(13).fill('screenTouch') }, request)).toThrow();
    expect(() => validateGeneratedLevel({ ...good,
      targets: [{ ...good.targets[0], radius: 0.01 }] }, request)).toThrow();
  });
});

describe('personalization', () => {
  it('waits for three rounds and changes at most one step', () => {
    const metrics = { gameId: 'tap-quest-precision', currentDifficulty: 3 as const,
      recentRounds: [round(0.4), round(0.5)] };
    expect(getPersonalizationRecommendation(metrics, preferences).recommendedDifficulty).toBe(3);
    expect(getPersonalizationRecommendation({ ...metrics, recentRounds: [...metrics.recentRounds, round(0.55)] },
      preferences).recommendedDifficulty).toBe(2);
    expect(getPersonalizationRecommendation({ ...metrics, recentRounds: [round(0.95), round(0.96), round(1)] },
      preferences).recommendedDifficulty).toBe(4);
  });

  it('honors manual selection, a difficulty ceiling, and untimed mode', () => {
    const result = getPersonalizationRecommendation({ gameId: 'memory', currentDifficulty: 4,
      manualDifficulty: 2, recentRounds: [round(1), round(1), round(1)] },
    { ...preferences, maximumDifficulty: 3, untimed: true });
    expect(result.recommendedDifficulty).toBe(2);
    expect(result.suggestedRoundLengthMs).toBeNull();
  });
});

describe('level service', () => {
  it('changes a repeated layout to a fresh local pattern', async () => {
    const service = createAIService();
    const first = await service.generateLevel({ ...request, variationSeed: 101 });
    const second = await service.generateLevel({ ...request, variationSeed: 101 });
    expect(first.source).toBe('local');
    expect(second.source).toBe('local');
    expect(second.targets).not.toEqual(first.targets);
  });

  it('keeps the local provider always available', async () => {
    const local = createLocalProvider();
    expect(await local.isAvailable()).toBe(true);
    expect(await local.testConnection()).toBe(true);
  });

  it('rejects levels that claim another source', () => {
    expect(() => validateGeneratedLevel({ ...generateLocalLevel(request), source: 'gemini' }, request)).toThrow();
  });
});
