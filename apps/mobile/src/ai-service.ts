import { createAIService, type AIProvider, type AIService, type GameGenerationRequest } from '@jimmyit/ai';

export const AI_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'] as const;
export type AIModel = typeof AI_MODELS[number];
export type AIProviderChoice = 'offline' | 'gemini';

export interface AISettings {
  readonly generationEnabled: boolean;
  readonly provider: AIProviderChoice;
  readonly model: AIModel;
  readonly personalizationEnabled: boolean;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  generationEnabled: false, provider: 'offline', model: 'gemini-3.8-flash',
  personalizationEnabled: false,
};

const serviceUrl = process.env.EXPO_PUBLIC_JIMMY_AI_URL?.replace(/\/$/, '') ?? '';

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  if (!serviceUrl) throw new Error('AI service unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${serviceUrl}${path}`, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error('AI service unavailable');
    return await response.json() as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Mobile never receives a Gemini key; this provider calls the trusted proxy only. */
export function createServerAIProvider(model: AIModel, sessionToken?: string): AIProvider {
  const sessionHeaders: Record<string, string> = sessionToken ? { 'X-Session-Token': sessionToken } : {};
  return {
    name: 'gemini',
    isAvailable: async () => {
      try {
        const result = await requestJson(`/status?model=${encodeURIComponent(model)}`, { headers: sessionHeaders });
        return isObject(result) && result.available === true;
      } catch { return false; }
    },
    testConnection: async () => {
      try {
        const result = await requestJson(`/status?model=${encodeURIComponent(model)}`, { headers: sessionHeaders });
        return isObject(result) && result.available === true;
      } catch { return false; }
    },
    generate: async (request: GameGenerationRequest) => {
      const result = await requestJson('/generate', { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...sessionHeaders },
        body: JSON.stringify({ optIn: true, model, request }) });
      if (!isObject(result)) throw new Error('Invalid AI response');
      return result.level;
    },
  };
}

/** Keep the returned token in memory only; the Gemini key never enters app storage. */
export async function registerGeminiKey(apiKey: string): Promise<string> {
  const result = await requestJson('/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }) });
  if (!isObject(result) || typeof result.token !== 'string') throw new Error('AI service unavailable');
  return result.token;
}

export async function removeGeminiKey(sessionToken: string): Promise<void> {
  await requestJson('/session', { method: 'DELETE', headers: { 'X-Session-Token': sessionToken } });
}

export function createConfiguredAIService(settings: AISettings, sessionToken?: string): AIService {
  return createAIService({
    enabled: settings.generationEnabled && settings.provider === 'gemini',
    remote: createServerAIProvider(settings.model, sessionToken),
  });
}
