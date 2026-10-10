// Public API of @jimmyit/game-sdk. Games import from here and nowhere else.

export type { MotorSkill, GameSession, GameLogic, GameDefinition, GameDevice } from './game-types';
export { defineGame, GameDefinitionError } from './define-game';
export { type GameRun, type GameStatus, type StartGameOptions, startGame } from './game-runner';

// Re-exported from core so game code needs a single import.
export {
  type FidgetEvent,
  type FidgetEventOf,
  type FidgetState,
  type FeedbackName,
  type ScoreCounter,
  type ScoreRecord,
  type StarThresholds,
  type Combo,
  type SwitchId,
  isSwitchDown,
  isSwitchUp,
  starsFor,
  proximityPoints,
  pointsForDuration,
  createCombo,
} from '@jimmyit/core';
