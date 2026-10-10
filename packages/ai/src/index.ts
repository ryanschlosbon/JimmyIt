/** Shared activity generation and personalization types. */
export type {
  AccessibilityPreferences, AIProvider, Difficulty, GameGenerationRequest, GameType,
  GeneratedLevel, GeneratedTarget, InputControl, PerformanceMetrics,
  PersonalizationRecommendation, RoundMetrics, Shape,
} from './types';
/** On-device level generation and provider fallback. */
export { createLocalProvider, generateLocalLevel } from './local';
export { type AIService, createAIService } from './service';
/** Rolling, deterministic activity recommendations. */
export { getPersonalizationRecommendation } from './personalization';
/** Validation of local and untrusted generated levels. */
export { defaultAccessibilityPreferences, validateGeneratedLevel, validateGenerationRequest } from './validation';
