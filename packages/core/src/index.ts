// Public API of @jimmyit/core. Anything not exported here is internal.

export {
  type SwitchId,
  type FidgetModeName,
  type CapabilityName,
  SWITCH_IDS,
  BasicModeId,
  PROTOCOL_VERSION,
  ProtocolError,
} from '@jimmyit/protocol';

export { type Unsubscribe, type Listener, type Emitter, createEmitter } from './util/emitter';
export {
  type Cancel,
  type Clock,
  type Scheduler,
  type ManualTime,
  systemClock,
  systemScheduler,
  createManualTime,
} from './util/time';

export {
  type FidgetState,
  type FidgetModeState,
  type SwitchStates,
  type FidgetEvent,
  type FidgetEventType,
  type FidgetEventOf,
  INITIAL_FIDGET_STATE,
  isSwitchDown,
  isSwitchUp,
} from './input/types';
export {
  type InputConfig,
  type InputStats,
  type InputTracker,
  DEFAULT_INPUT_CONFIG,
  createInputTracker,
  squeezeLevelFromRaw,
} from './input/input-tracker';

export type { ScoreRecord, ScoreSource, Stars } from './scoring/types';
export { type ScoreCounter, type ScoreSnapshot, createScoreCounter } from './scoring/score-counter';
export {
  type StarThresholds,
  type Combo,
  starsFor,
  proximityPoints,
  pointsForDuration,
  createCombo,
} from './scoring/scoring-helpers';
export {
  type AppScoreRecordInput,
  ScoreRecordError,
  createAppScoreRecord,
  validateScoreRecord,
  formatDeviceId,
} from './scoring/score-records';
export { type BasicModeInfo, BASIC_MODES, basicModeById, gameIdForBasicMode } from './scoring/basic-modes';

export { type KeyValueStore, createMemoryKeyValueStore } from './storage/key-value-store';
export {
  type ScoreRepository,
  type ScoreFilter,
  type ScoreSummary,
  type GameSummary,
  SCORE_STORAGE_KEY,
  SCORE_SCHEMA_VERSION,
  ScoreStorageError,
  createScoreRepository,
} from './storage/score-repository';

export { HapticEffect, Feedback, type FeedbackName } from './device/feedback';
export type { FidgetTransport } from './device/transport';
export {
  type FidgetClient,
  type FidgetClientOptions,
  type FidgetInfo,
  type FidgetRecord,
  type FidgetDeviceError,
  type ShowScoreOptions,
  ProtocolVersionMismatchError,
  FidgetDisconnectedError,
  FidgetTimeoutError,
  connectFidgetClient,
} from './device/fidget-client';

export {
  type SyncResult,
  fidgetRecordToScoreRecord,
  syncFidgetRecords,
  pushBestsToFidget,
  saveLiveFidgetRecords,
  startScoreSync,
} from './sync/fidget-sync';
