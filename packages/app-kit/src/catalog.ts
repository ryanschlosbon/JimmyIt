import { BASIC_MODES } from '@jimmyit/core';
import type { GameDefinition, MotorSkill } from '@jimmyit/game-sdk';

/** Menu and scoreboard facts about one game, with no rules or UI attached. */
export interface CatalogEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly skills: readonly MotorSkill[];
  readonly needsToy: boolean;
  /** 'toy' games run on the toy itself and reach the app by sync. */
  readonly playedOn: 'app' | 'toy';
}

type DescribedGame = Pick<GameDefinition<unknown>, 'id' | 'title' | 'description' | 'skills' | 'needsToy'>;

export function catalogEntry(game: DescribedGame): CatalogEntry {
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    skills: game.skills,
    needsToy: game.needsToy ?? true,
    playedOn: 'app',
  };
}

/** The games the toy plays by itself (firmware basic modes), for scoreboards. */
export const TOY_GAMES: readonly CatalogEntry[] = BASIC_MODES.map((mode) => ({
  id: mode.gameId,
  title: mode.title,
  description: 'Played on the toy, synced when it connects.',
  skills: ['press', 'spin', 'screw', 'slide', 'toggle'],
  needsToy: true,
  playedOn: 'toy',
}));

/** App games first, then toy games; later entries never replace earlier ids. */
export function createGameCatalog(appGames: readonly DescribedGame[]): readonly CatalogEntry[] {
  const entries = new Map<string, CatalogEntry>();
  for (const entry of [...appGames.map(catalogEntry), ...TOY_GAMES]) {
    if (!entries.has(entry.id)) entries.set(entry.id, entry);
  }
  return [...entries.values()];
}
