import {
  type Clock,
  createAppId,
  createEmitter,
  createScoreRepository,
  type KeyValueStore,
  type Listener,
  type Scheduler,
  type ScoreEvent,
  type ScoreRepository,
  systemClock,
  systemScheduler,
  type Unsubscribe,
} from '@jimmyit/core';
import { type GameDefinition, type GameRun, startGame } from '@jimmyit/game-sdk';
import { type AppIdentity, type ConnectionManager, createConnectionManager, type ToyConnector } from './connection';
import { createRewardWatcher, type Reward } from './rewards';

export const APP_ID_STORAGE_KEY = 'jimmyit.appId';

export class ToyNotConnectedError extends Error {
  override name = 'ToyNotConnectedError';
  constructor(gameId: string) {
    super(`"${gameId}" needs the toy, and no toy is connected`);
  }
}

/** Everything the app's screens need, created once at startup. */
export interface JimmyServices {
  readonly repository: ScoreRepository;
  readonly connection: ConnectionManager;
  /** Starts a game, wired to the connected toy if there is one. */
  play<TState, TAction = never>(game: GameDefinition<TState, TAction>, options?: { tickMs?: number }): GameRun<TState, TAction>;
  /** Whether `game` can start right now (screen-only games always can). */
  canPlay(game: Pick<GameDefinition<unknown>, 'needsToy'>): boolean;
  /**
   * Every score moment, from app games (source 'app') and from games the toy is
   * running by itself while connected (source 'toy'). Drive celebrations from this.
   */
  onScoreEvent(listener: Listener<ScoreEvent>): Unsubscribe;
  /**
   * A level-up or a new badge, from any record saved after startup (app games,
   * and toy games synced or finished live). The connected toy already plays the
   * `levelUp` or `badge` haptic (level-up wins if both); use this for the screen.
   */
  onReward(listener: Listener<Reward>): Unsubscribe;
}

export interface JimmyServicesOptions {
  /** AsyncStorage in the app; createMemoryKeyValueStore() in tests. */
  readonly storage: KeyValueStore;
  /** Simulated toy, Bluetooth, or null when no toy can be reached in this build. */
  readonly connector: ToyConnector | null;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
  /** Toy commands during play are fire-and-forget; failures land here. */
  readonly onDeviceError?: (error: unknown) => void;
  /** Shown on the toy when it asks "connect to …?" (15 chars). Default "Jimmy app". */
  readonly appName?: string;
}

/** A stable id for this install, kept in storage, so the toy remembers this phone. */
async function loadAppId(storage: KeyValueStore): Promise<number> {
  const saved = Number(await storage.getItem(APP_ID_STORAGE_KEY).catch(() => null));
  if (Number.isInteger(saved) && saved > 0 && saved <= 0xffffffff) return saved;
  const appId = createAppId() || 1;
  await storage.setItem(APP_ID_STORAGE_KEY, String(appId)).catch(() => undefined);
  return appId;
}

export function createJimmyServices(options: JimmyServicesOptions): JimmyServices {
  const clock = options.clock ?? systemClock;
  const scheduler = options.scheduler ?? systemScheduler;
  const repository = createScoreRepository(options.storage);
  const scoreEvents = createEmitter<ScoreEvent>();
  let identity: Promise<AppIdentity> | null = null;
  const connection = createConnectionManager({
    connector: options.connector,
    repository,
    clock,
    scheduler,
    identity: () => {
      identity ??= loadAppId(options.storage).then((appId) => ({ appId, appName: options.appName ?? 'Jimmy app' }));
      return identity;
    },
    onToyScoreEvent: (event) => scoreEvents.emit(event),
  });

  // One haptic per save or sync, however many rewards it brought.
  const rewards = createRewardWatcher(repository, (found) => {
    const feedback = found.some((reward) => reward.type === 'levelUp') ? 'levelUp' : 'badge';
    connection.getClient()?.feedback(feedback).catch(options.onDeviceError ?? (() => undefined));
  });

  const canPlay: JimmyServices['canPlay'] = (game) => game.needsToy === false || connection.getClient() !== null;

  return {
    repository,
    connection,
    canPlay,
    onScoreEvent: (listener) => scoreEvents.subscribe(listener),
    onReward: (listener) => rewards.onReward(listener),
    play(game, playOptions = {}) {
      if (!canPlay(game)) throw new ToyNotConnectedError(game.id);
      return startGame(game, {
        device: connection.getClient(),
        repository,
        clock,
        scheduler,
        ...(playOptions.tickMs === undefined ? {} : { tickMs: playOptions.tickMs }),
        ...(options.onDeviceError ? { onDeviceError: options.onDeviceError } : {}),
        onScoreEvent: (event) => scoreEvents.emit(event),
      });
    },
  };
}
