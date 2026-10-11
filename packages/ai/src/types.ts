export type GameType = 'tapQuest' | 'shapeQuest' | 'memoryQuest' | 'reaction' | 'calm';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type InputControl = 'screenTouch' | 'clicker' | 'navLeft' | 'navRight' | 'spinner';
export type Shape = 'circle' | 'square' | 'rectangle' | 'triangle';

export interface AccessibilityPreferences {
  readonly reducedMotion: boolean;
  readonly soundEnabled: boolean;
  readonly untimed: boolean;
  readonly minimumTargetRadius: number;
  readonly maximumDifficulty: Difficulty;
  readonly allowDistractions: boolean;
}

export interface RoundMetrics {
  readonly accuracy: number;
  readonly completionRate: number;
  readonly successfulInputs: number;
  readonly incorrectInputs: number;
  readonly averageResponseMs?: number;
}

export interface PerformanceMetrics {
  readonly gameId: string;
  /** Newest rounds last; the engine uses the last five. */
  readonly recentRounds: readonly RoundMetrics[];
  readonly currentDifficulty: Difficulty;
  readonly manualDifficulty?: Difficulty;
}

export interface GameGenerationRequest {
  readonly gameType: GameType;
  readonly theme: string;
  readonly difficulty: Difficulty;
  readonly accessibilityPreferences: AccessibilityPreferences;
  readonly targetCount?: number;
  /** Changes the layout while keeping a given request reproducible. */
  readonly variationSeed?: number;
  readonly availableInputControls: readonly InputControl[];
  readonly performance?: PerformanceMetrics;
}

export interface GeneratedTarget {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly order: number;
  readonly shape?: Shape;
}

export interface GeneratedLevel {
  readonly id: string;
  readonly title: string;
  readonly instructions: string;
  readonly gameType: GameType;
  readonly difficulty: Difficulty;
  readonly targets: readonly GeneratedTarget[];
  readonly sequence: readonly InputControl[];
  readonly theme: string;
  readonly timing: { readonly responseWindowMs: number | null; readonly activityDurationMs: number | null };
  readonly sensory: { readonly motion: boolean; readonly sound: boolean; readonly distractions: boolean };
  readonly source: 'local';
}

export interface PersonalizationRecommendation {
  readonly currentDifficulty: Difficulty;
  readonly recommendedDifficulty: Difficulty;
  readonly suggestedTargetRadius: number;
  readonly suggestedTargetCount: number;
  readonly suggestedResponseWindowMs: number | null;
  readonly suggestedSequenceLength: number;
  readonly suggestedRoundLengthMs: number | null;
  readonly suggestedDistractions: boolean;
  readonly suggestedNextActivity: GameType;
  readonly explanation: string;
  readonly source: 'local';
}

export interface AIProvider {
  readonly name: 'local';
  isAvailable(): Promise<boolean>;
  generate(request: GameGenerationRequest): Promise<unknown>;
  testConnection(): Promise<boolean>;
}
