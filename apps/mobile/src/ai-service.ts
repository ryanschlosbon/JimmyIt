import { createAIService, type AIService } from '@jimmyit/ai';

export interface AISettings {
  readonly personalizationEnabled: boolean;
}

export const DEFAULT_AI_SETTINGS: AISettings = { personalizationEnabled: false };

/** Reads saved settings, including ones saved while Gemini options existed; unknown fields are dropped. */
export function parseAISettings(raw: string | null): AISettings {
  if (!raw) return DEFAULT_AI_SETTINGS;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === 'object' && value !== null && !Array.isArray(value) &&
      typeof (value as Record<string, unknown>).personalizationEnabled === 'boolean') {
      return { personalizationEnabled: (value as Record<string, unknown>).personalizationEnabled as boolean };
    }
  } catch {
    // Unreadable settings fall back to the defaults.
  }
  return DEFAULT_AI_SETTINGS;
}

/** Activity levels are generated on this device only. */
export function createConfiguredAIService(): AIService {
  return createAIService();
}
