import type { GameDefinition } from './game-types';

const GAME_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class GameDefinitionError extends Error {
  override name = 'GameDefinitionError';
}

/** Checks a game definition once, at import time, and returns it unchanged. */
export function defineGame<TState>(game: GameDefinition<TState>): GameDefinition<TState> {
  const fail = (why: string): never => {
    throw new GameDefinitionError(`game "${game.id}": ${why}`);
  };
  if (!GAME_ID.test(game.id)) fail('id must be kebab-case');
  if (game.id.startsWith('fidget-')) fail('ids starting with "fidget-" are reserved for fidget basic modes');
  if (game.title.trim() === '') fail('title is empty');
  if (game.skills.length === 0) fail('list at least one skill');
  if (game.durationMs !== null && !(game.durationMs > 0)) fail('durationMs must be > 0 or null');
  const [one, two, three] = game.starThresholds;
  if (!(0 < one && one <= two && two <= three)) fail('starThresholds must be positive and ascending');
  return game;
}
