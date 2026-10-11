import { createAppScoreRecord, createMemoryKeyValueStore, createScoreRepository, type ScoreEvent } from '@jimmyit/core';
import { describe, expect, it, vi } from 'vitest';
import { defineGame } from './define-game';
import { startGame } from './game-runner';
import type { GameDevice } from './game-types';
import { createGameTestHarness } from './testing';

const tapGame = defineGame<null>({
  id: 'tap-forty',
  title: 'Tap forty',
  description: '+40 per clicker press.',
  skills: ['press'],
  durationMs: 10_000,
  starThresholds: [40, 80, 120],
  create(session) {
    return {
      getState: () => null,
      onEvent(event) {
        if (event.type === 'switchDown' && event.switchId === 'clicker') session.score.add(40);
      },
    };
  },
});

async function withBest(best: number) {
  const storage = createMemoryKeyValueStore();
  await createScoreRepository(storage).save(
    createAppScoreRecord({
      gameId: 'tap-forty',
      deviceId: null,
      startedAtMs: Date.UTC(2025, 0, 1),
      durationMs: 1000,
      snapshot: { score: best, actions: 1, metrics: {} },
      stars: 0,
      completed: true,
      newBest: true,
    }),
  );
  const h = await createGameTestHarness(tapGame, { storage });
  const events: ScoreEvent[] = [];
  h.run.onScoreEvent((event) => events.push(event));
  // Events start once the previous best has loaded (milliseconds in the app).
  await vi.waitFor(() => expect(events[0]?.kind).toBe('gameStart'));
  return { h, events };
}

describe('score events from app games', () => {
  it('fires the same moments as the toy, and passes them to the toy', async () => {
    const { h, events } = await withBest(100);
    h.fidget.tap('clicker');
    h.fidget.tap('clicker');
    h.fidget.tap('clicker');
    await h.playToEnd();

    expect(events.map((e) => [e.kind, e.score, e.value])).toEqual([
      ['gameStart', 0, 100],
      ['points', 40, 40],
      ['points', 80, 40],
      ['points', 120, 40],
      ['milestone', 120, 100],
      ['newBest', 120, 100],
      ['gameEnd', 120, 100],
    ]);
    expect(events.every((e) => e.source === 'app' && e.gameId === 'tap-forty')).toBe(true);

    // The toy gets points merged when they come faster than 150 ms apart.
    expect(h.fidget.scoreEvents.map((e) => [e.kind, e.score, e.value])).toEqual([
      ['gameStart', 0, 100],
      ['points', 40, 40],
      ['points', 120, 80],
      ['milestone', 120, 100],
      ['newBest', 120, 100],
      ['gameEnd', 120, 100],
    ]);
    // The toy celebrated gameEnd itself, so the app sends no extra end haptic.
    expect(h.fidget.haptics).toEqual([]);
  });

  it('sends spaced-out points one by one', async () => {
    const { h } = await withBest(0);
    h.fidget.tap('clicker');
    h.advance(200);
    h.fidget.tap('clicker');
    expect(h.fidget.scoreEvents.filter((e) => e.kind === 'points').map((e) => e.score)).toEqual([40, 80]);
  });
});

describe('the toy during an app game', () => {
  it('takes the toy for the game and hands it back when the game ends', async () => {
    const { h, events } = await withBest(0);
    expect(h.fidget.mode).toBe('app');
    h.fidget.tap('clicker');
    await h.playToEnd();
    // Handed back once the score is on the toy, which is a moment after the result.
    expect(h.fidget.display.score?.score).toBe(40);
    await vi.waitFor(() => expect(h.fidget.mode).toBe('standalone'));
    // gameEnd reaches the toy before the hand-back, so the toy can show the score.
    expect(h.fidget.scoreEvents.at(-1)?.kind).toBe('gameEnd');
    expect(events.at(-1)?.kind).toBe('gameEnd');
  });

  it('hands the toy back when the child quits early', async () => {
    const { h } = await withBest(0);
    await h.run.quit();
    await vi.waitFor(() => expect(h.fidget.mode).toBe('standalone'));
  });
});

describe('a toy that comes and goes during a game', () => {
  it('hears a toy that connects after the game started, and lets go of one that drops', async () => {
    // The harness's game runs without the toy; its connected client stands in for one that shows up later.
    const h = await createGameTestHarness(tapGame, { toy: false });
    let toy: GameDevice | null = null;
    const listeners = new Set<() => void>();
    const changed = () => listeners.forEach((listener) => listener());
    const run = startGame(tapGame, {
      repository: h.repository,
      devices: { current: () => toy, onChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      } },
    });

    h.fidget.tap('clicker');
    expect(run.getScore().score).toBe(0);

    toy = h.client;
    changed();
    expect(h.fidget.mode).toBe('app'); // handed the toy's screen as it arrives
    h.fidget.tap('clicker');
    expect(run.getScore().score).toBe(40);

    toy = null;
    changed();
    h.fidget.tap('clicker');
    expect(run.getScore().score).toBe(40);

    toy = h.client; // reconnects: heard again
    changed();
    h.fidget.tap('clicker');
    expect(run.getScore().score).toBe(80);

    await run.quit();
    expect(listeners.size).toBe(0);
    h.fidget.tap('clicker');
    expect(run.getScore().score).toBe(80);
  });
});
