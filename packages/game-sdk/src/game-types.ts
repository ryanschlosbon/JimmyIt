import type { FeedbackName, FidgetClient, FidgetEvent, FidgetState, ScoreCounter, StarThresholds, ToyAction } from '@jimmyit/core';

/**
 * Which hand skill a game practices. Used for menus and progress views. Same
 * names as ToyAction, plus 'draw' for screen games played with a finger or stylus.
 */
export type MotorSkill = ToyAction | 'draw';

/** What a game is allowed to do. Deliberately smaller than FidgetClient. */
export interface GameSession {
  readonly score: ScoreCounter;
  /** Current toy state, e.g. spinner angle or which switches are held. All idle if no toy is connected. */
  getInput(): FidgetState;
  /** Play time so far, not counting pauses. */
  elapsedMs(): number;
  feedback(name: FeedbackName): void;
  /** Raw DRV2605L effect ids. Prefer feedback() so games feel consistent. */
  haptic(...effects: number[]): void;
  /** Shows text on the toy's OLED (line 0-3, 18 chars). */
  showOnFidget(line: number, text: string): void;
  showProgressOnFidget(percent: number, label?: string): void;
  /** Ends the game as completed. For games without a fixed duration. */
  finish(): void;
}

/**
 * A game's rules, with no UI. `TState` is whatever the game's view needs to
 * draw; the view reads it with GameRun.getState() and re-renders on subscribe().
 */
export interface GameLogic<TState, TAction = never> {
  getState(): TState;
  onStart?(): void;
  onEvent?(event: FidgetEvent): void;
  /** Handles a game-specific action from its view, such as a completed drawing. */
  onAction?(action: TAction): void;
  /** Called every tick (default 50 ms) with time since start. */
  onTick?(elapsedMs: number): void;
  onFinish?(): void;
}

export interface GameDefinition<TState, TAction = never> {
  /** kebab-case, unique, never changed once released (saved scores use it). */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly skills: readonly MotorSkill[];
  /** Fixed length, or null if the game calls session.finish() itself. */
  readonly durationMs: number | null;
  readonly starThresholds: StarThresholds;
  /** False for screen-only games (drawing) that can run with no toy connected. Default true. */
  readonly needsToy?: boolean;
  create(session: GameSession): GameLogic<TState, TAction>;
}

/** The subset of FidgetClient a running game uses. FidgetClient satisfies it. */
export type GameDevice = Pick<
  FidgetClient,
  | 'info'
  | 'getState'
  | 'onEvent'
  | 'haptic'
  | 'feedback'
  | 'showText'
  | 'showScore'
  | 'showProgress'
  | 'clearDisplay'
  | 'setMode'
  | 'sendScoreEvent'
>;
