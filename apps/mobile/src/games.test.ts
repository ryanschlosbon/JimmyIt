import { describe, expect, it } from 'vitest';
import { DRAWING_GAMES, GAME_CATALOG, TIMED_PRACTICE_SECONDS, timedPracticeGame } from './games';

describe('game registry', () => {
  it('lists every app game and every toy game, once each', () => {
    const ids = GAME_CATALOG.map(game => game.id);
    expect(ids).toEqual(['drawing-with-jimmy', 'shape-challenge', 'timed-motor-practice', 'fidget-free-play', 'fidget-spin-count']);
    expect(GAME_CATALOG.find(game => game.id === 'drawing-with-jimmy')).toMatchObject({ needsToy: false, playedOn: 'app' });
    expect(GAME_CATALOG.find(game => game.id === 'fidget-free-play')).toMatchObject({ playedOn: 'toy' });
  });

  it('offers each practice length with the shared timed-practice id', () => {
    expect(TIMED_PRACTICE_SECONDS).toEqual([30, 60, 90]);
    expect(timedPracticeGame(60_000)).toMatchObject({ id: 'timed-motor-practice', durationMs: 60_000 });
    expect(timedPracticeGame(60_000)).toBe(timedPracticeGame(60_000));
    expect(DRAWING_GAMES.shapes.id).toBe('shape-challenge');
  });
});
