// Test kit for game authors: import from "@jimmyit/game-sdk/testing" in
// *.test.ts files only. Never import this from game logic or app code.
import {
  connectFidgetClient,
  createManualTime,
  createMemoryKeyValueStore,
  createScoreRepository,
  type FidgetClient,
  type KeyValueStore,
  type ScoreRecord,
  type ScoreRepository,
} from '@jimmyit/core';
import { createFakeFidget, type FakeFidget } from '@jimmyit/fake-fidget';
import { type GameRun, startGame } from './game-runner';

export { createMemoryKeyValueStore, type KeyValueStore } from '@jimmyit/core';
import type { GameDefinition } from './game-types';

export interface GameTestHarness<TState, TAction = never> {
  readonly run: GameRun<TState, TAction>;
  /** Drive the toy: press, release, tap, spin, turnScrew… and inspect display/haptics. */
  readonly fidget: FakeFidget;
  readonly client: FidgetClient;
  readonly repository: ScoreRepository;
  /** Moves the game clock forward, running ticks in order. */
  advance(ms: number): void;
  /** Advances until the game ends (at most `maxMs`) and returns the saved record. */
  playToEnd(maxMs?: number): Promise<ScoreRecord>;
}

/** 2026-01-01T00:00:00Z, so saved records have realistic timestamps. */
const HARNESS_START_MS = Date.UTC(2026, 0, 1);

export async function createGameTestHarness<TState, TAction = never>(
  game: GameDefinition<TState, TAction>,
  options: {
    tickMs?: number;
    /** false runs the game with no toy connected, as screen-only games are played. Default true. */
    toy?: boolean;
    /** Storage behind the repository, e.g. one that fails to test save retries. */
    storage?: KeyValueStore;
  } = {},
): Promise<GameTestHarness<TState, TAction>> {
  const time = createManualTime(HARNESS_START_MS);
  const fidget = createFakeFidget({ clock: time.clock });
  const client = await connectFidgetClient(fidget.transport, { clock: time.clock, scheduler: time.scheduler });
  const repository = createScoreRepository(options.storage ?? createMemoryKeyValueStore());
  const run = startGame(game, {
    device: options.toy === false ? null : client,
    repository,
    clock: time.clock,
    scheduler: time.scheduler,
    ...(options.tickMs === undefined ? {} : { tickMs: options.tickMs }),
    onDeviceError: (error) => {
      throw error;
    },
  });
  return {
    run,
    fidget,
    client,
    repository,
    advance: (ms) => time.advance(ms),
    async playToEnd(maxMs = game.durationMs ?? 10 * 60_000) {
      time.advance(maxMs);
      if (run.status === 'running') throw new Error(`${game.id} was still running after ${maxMs} ms`);
      return run.result;
    },
  };
}
