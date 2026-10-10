// Public API of @jimmyit/app-kit: the app's logic with no UI. Screens (current
// or redesigned) render what these return and call these functions; nothing
// here knows about layout, colors or navigation.

export {
  type JimmyServices,
  type JimmyServicesOptions,
  APP_ID_STORAGE_KEY,
  createJimmyServices,
  ToyNotConnectedError,
} from './services';
export {
  type ToyConnector,
  type ConnectionManager,
  type ConnectionSnapshot,
  type ConnectionStatus,
  type ConnectionError,
  type ConnectionErrorKind,
  type AppIdentity,
  createConnectionManager,
} from './connection';
export { type Progress, type Badge, type BadgeId, POINTS_PER_LEVEL, getProgress, longestStreakDays } from './progress';
export { type Scoreboard, type ScoreboardRow, getScoreboard } from './scoreboard';
export { type CatalogEntry, TOY_GAMES, catalogEntry, createGameCatalog } from './catalog';
export {
  JimmyServicesProvider,
  useJimmyServices,
  useConnection,
  useToyState,
  useScores,
  useGameRun,
  useScoreEvents,
  useCelebration,
  type Celebration,
  type CelebrationKind,
  type ConnectionControls,
  type ScoresView,
  type GameRunControls,
} from './react';
