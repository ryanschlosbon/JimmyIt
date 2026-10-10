import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultAccessibilityPreferences, type GameGenerationRequest } from '@jimmyit/ai';

const request: GameGenerationRequest = { gameType: 'tapQuest', theme: 'garden', difficulty: 2,
  accessibilityPreferences: defaultAccessibilityPreferences(), availableInputControls: ['screenTouch'], targetCount: 3 };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('mobile AI service', () => {
  it('registers a session key with the proxy without persisting it', async () => {
    vi.stubEnv('EXPO_PUBLIC_JIMMY_AI_URL', 'http://localhost:8787');
    const calls: RequestInit[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(init);
      return { ok: true, json: async () => ({ token: 'session-token' }) };
    }));
    const { registerGeminiKey, removeGeminiKey } = await import('./ai-service');
    expect(await registerGeminiKey('test-secret-key')).toBe('session-token');
    expect(calls[0]?.body).toBe(JSON.stringify({ apiKey: 'test-secret-key' }));
    await removeGeminiKey('session-token');
    expect(calls[1]?.headers).toMatchObject({ 'X-Session-Token': 'session-token' });
  });
  it('uses local generation when cloud is disabled', async () => {
    const { createConfiguredAIService, DEFAULT_AI_SETTINGS } = await import('./ai-service');
    const service = createConfiguredAIService(DEFAULT_AI_SETTINGS);
    expect((await service.generateLevel(request)).source).toBe('local');
  });

  it('requires a configured proxy and never sends performance history', async () => {
    vi.stubEnv('EXPO_PUBLIC_JIMMY_AI_URL', 'http://localhost:8787');
    const calls: { url: string; body?: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined });
      if (url.includes('/status')) return { ok: true, json: async () => ({ available: true }) };
      return { ok: false };
    }));
    const { createConfiguredAIService, DEFAULT_AI_SETTINGS } = await import('./ai-service');
    const service = createConfiguredAIService({ ...DEFAULT_AI_SETTINGS, generationEnabled: true, provider: 'gemini' });
    expect((await service.generateLevel({ ...request, performance: { gameId: 'tap-quest', currentDifficulty: 2,
      recentRounds: [{ accuracy: 1, completionRate: 1, successfulInputs: 3, incorrectInputs: 0 }] } })).source).toBe('local');
    expect(calls.some((call) => call.url.endsWith('/generate'))).toBe(true);
    expect(calls.find((call) => call.body)?.body).toContain('"optIn":true');
    expect(calls.find((call) => call.body)?.body).not.toContain('recentRounds');
  });
});
