// Public API of @jimmyit/game-sdk. Games import from here and nowhere else.

export type { MotorSkill, GameSession, GameLogic, GameDefinition, GameDevice } from './game-types';
export { defineGame, GameDefinitionError } from './define-game';
export {
  type GameDeviceSource,
  type GameRun,
  type GameStatus,
  type SaveStatus,
  type StartGameOptions,
  TOY_POINTS_EVENT_GAP_MS,
  startGame,
} from './game-runner';

// Re-exported from core so game code needs a single import.
export {
  type FidgetEvent,
  type FidgetEventOf,
  type FidgetState,
  type FeedbackName,
  type ScoreCounter,
  type ScoreRecord,
  type ScoreEvent,
  type StarThresholds,
  type Combo,
  type SwitchId,
  type ToyAction,
  type ToyActionTracker,
  TOY_ACTIONS,
  createToyActionTracker,
  isSwitchDown,
  isSwitchUp,
  starsFor,
  proximityPoints,
  pointsForDuration,
  createCombo,
} from '@jimmyit/core';
