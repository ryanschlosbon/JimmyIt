import { GAME_CATALOG, SHAPE_CHALLENGE_GAME, TAP_QUEST_MODES, tapQuestGame } from '../../mobile/src/games';

// Web uses the mobile registry and game configuration without importing mobile screens.
export { GAME_CATALOG };
export const SHAPE_GAME = SHAPE_CHALLENGE_GAME;
export const TAP_MODES = TAP_QUEST_MODES.map(({ mode }) => mode);
export const createAdaptiveTapGame = tapQuestGame;
