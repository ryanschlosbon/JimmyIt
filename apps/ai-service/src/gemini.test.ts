import { describe, expect, it, vi } from 'vitest';
import { generateLocalLevel, defaultAccessibilityPreferences, type GameGenerationRequest } from '@jimmyit/ai';
import { createGeminiProvider } from './gemini';

const request: GameGenerationRequest = { gameType: 'tapQuest', theme: 'garden', difficulty: 2,
  accessibilityPreferences: defaultAccessibilityPreferences(), availableInputControls: ['screenTouch'], targetCount: 3 };

describe('Gemini provider', () => {
  it('is unavailable without a server key or for unsupported models', async () => {
    expect(await createGeminiProvider({}).isAvailable()).toBe(false);
    const client = { models: { get: async () => ({ supportedActions: ['generateContent'] }),
      generateContent: async () => ({ text: '{}' }) } };
    expect(await createGeminiProvider({ client, model: 'gemini-2.0-flash' }).isAvailable()).toBe(false);
    expect(await createGeminiProvider({ client: { models: { ...client.models,
      get: async () => ({ supportedActions: [] }) } } }).isAvailable()).toBe(false);
  });

  it('validates structured JSON and keeps performance rounds out of the prompt', async () => {
    let contents = '';
    const valid = { ...generateLocalLevel(request), source: 'gemini' };
    const provider = createGeminiProvider({ client: { models: {
      get: async () => ({ supportedActions: ['generateContent'] }),
      generateContent: async (input) => { contents = input.contents; return { text: JSON.stringify(valid) }; },
    } } });
    const input = { ...request, variationSeed: 101, performance: { gameId: 'tap-quest', currentDifficulty: 2 as const,
      recentRounds: [{ accuracy: 0.8, completionRate: 0.8, successfulInputs: 8, incorrectInputs: 2 }] } };
    expect(await provider.generate(input)).toEqual(valid);
    expect(contents).not.toContain('recentRounds');
    expect(contents).toContain('"variationSeed":101');
  });

  it('rejects malformed, unsafe, and failed responses', async () => {
    for (const generateContent of [
      async () => ({ text: '{' }),
      async () => ({ text: JSON.stringify({ ...generateLocalLevel(request), source: 'gemini',
        sensory: { motion: true, sound: true, distractions: true } }) }),
      async () => { throw new Error('credential detail'); },
    ]) {
      const provider = createGeminiProvider({ client: { models: {
        get: async () => ({ supportedActions: ['generateContent'] }), generateContent,
      } } });
      await expect(provider.generate(request)).rejects.toThrow();
    }
  });

  it('aborts a slow generation request', async () => {
    vi.useFakeTimers();
    try {
      const provider = createGeminiProvider({ timeoutMs: 100, client: { models: {
        get: async () => ({ supportedActions: ['generateContent'] }),
        generateContent: async ({ config }) => new Promise((_resolve, reject) => {
          config.abortSignal.addEventListener('abort', () => reject(new Error('timed out')), { once: true });
        }),
      } } });
      const pending = provider.generate(request);
      const assertion = expect(pending).rejects.toThrow('timed out');
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
