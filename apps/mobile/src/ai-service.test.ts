import { describe, expect, it } from 'vitest';
import { defaultAccessibilityPreferences, type GameGenerationRequest } from '@jimmyit/ai';
import { createConfiguredAIService, DEFAULT_AI_SETTINGS, parseAISettings } from './ai-service';

const request: GameGenerationRequest = { gameType: 'tapQuest', theme: 'garden', difficulty: 2,
  accessibilityPreferences: defaultAccessibilityPreferences(), availableInputControls: ['screenTouch'], targetCount: 3 };

describe('mobile AI service', () => {
  it('generates levels on this device', async () => {
    expect((await createConfiguredAIService().generateLevel(request)).source).toBe('local');
  });

  it('keeps suggestions from settings saved with the old Gemini options', () => {
    expect(parseAISettings(JSON.stringify({ generationEnabled: true, provider: 'gemini',
      model: 'gemini-3.8-flash', personalizationEnabled: true }))).toEqual({ personalizationEnabled: true });
    expect(parseAISettings(null)).toEqual(DEFAULT_AI_SETTINGS);
    expect(parseAISettings('{')).toEqual(DEFAULT_AI_SETTINGS);
    expect(parseAISettings('[]')).toEqual(DEFAULT_AI_SETTINGS);
  });
});
