import {
  type Clock,
  createAppScoreRecord,
  createEmitter,
  createScoreCounter,
  createScoreEventTracker,
  INITIAL_FIDGET_STATE,
  type Listener,
  type Scheduler,
  type ScoreEvent,
  type ScoreEventDraft,
  type ScoreEventTracker,
  type ScoreRecord,
  type ScoreRepository,
  type ScoreSnapshot,
  starsFor,
  systemClock,
  systemScheduler,
  type Unsubscribe,
} from '@jimmyit/core';
import type { GameDefinition, GameDevice, GameSession } from './game-types';

export interface StartGameOptions {
  /** The connected toy, or null for screen-only games played without one. */
  readonly device?: GameDevice | null;
  readonly repository: ScoreRepository;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
  readonly tickMs?: number;
  /** Take over the toy's OLED during the game (ending any toy game), then hand it back. Default true. */
  readonly useFidgetDisplay?: boolean;
  /** Toy commands are fire-and-forget during play; failures land here. */
  readonly onDeviceError?: (error: unknown) => void;
  /** Also receives every score event (app-kit uses this to feed one app-wide stream). */
  readonly onScoreEvent?: (event: ScoreEvent) => void;
}

/** Points events closer together than this reach the toy merged into one. */
export const TOY_POINTS_EVENT_GAP_MS = 150;

export type GameStatus = 'running' | 'paused' | 'finished';
export type SaveStatus = 'notStarted' | 'saving' | 'saved' | 'failed';

/** One play of one game. The frontend's game screen holds this. */
export interface GameRun<TState, TAction = never> {
  readonly gameId: string;
  readonly status: GameStatus;
  /** Where saving the finished game's record stands; 'failed' means offer a retry. */
  readonly saveStatus: SaveStatus;
  getState(): TState;
  getScore(): ScoreSnapshot;
  /** Play time so far, not counting pauses. */
  elapsedMs(): number;
  /** Time left for fixed-length games; null for games that end themselves. */
  remainingMs(): number | null;
  /** Sends a game-specific action to the running game; ignored after completion. */
  submit(action: TAction): void;
  /** Stops the clock and ignores input until resume(). For breaks and app switches. */
  pause(): void;
  resume(): void;
  /** Called whenever state, score or status may have changed. */
  subscribe(listener: Listener<void>): Unsubscribe;
  /**
   * Moments to celebrate on screen: gameStart, points, milestone (every 100),
   * newBest (passing the old best), gameEnd. The toy gets the same moments.
   */
  onScoreEvent(listener: Listener<ScoreEvent>): Unsubscribe;
  /** Ends early because the child stopped; saved with completed = false. */
  quit(): Promise<ScoreRecord>;
  /** Saves the same record again after saveStatus became 'failed'. Never saves twice. */
  retrySave(): Promise<ScoreRecord>;
  /** Resolves with the saved record once the game ends and saving succeeds. */
  readonly result: Promise<ScoreRecord>;
}

const DEFAULT_TICK_MS = 50;

export function startGame<TState, TAction = never>(
  game: GameDefinition<TState, TAction>, options: StartGameOptions,
): GameRun<TState, TAction> {
  const { repository } = options;
  const device = options.device ?? null;
  const clock = options.clock ?? systemClock;
  const scheduler = options.scheduler ?? systemScheduler;
  const useDisplay = (options.useFidgetDisplay ?? true) && device !== null;
  const onDeviceError = options.onDeviceError ?? (() => undefined);

  const startedAtMs = clock.now();
  const score = createScoreCounter();
  const changes = createEmitter<void>();
  const scoreEvents = createEmitter<ScoreEvent>();
  // The toy plays its own animation and haptic for each moment, when it can.
  const toyCelebrates = device?.info.capabilities.has('scoreEvents') ?? false;
  let tracker: ScoreEventTracker | null = null;
  let pendingToyPoints: { score: number; value: number } | null = null;
  let lastToyPointsMs = Number.NEGATIVE_INFINITY;
  let status: GameStatus = 'running';
  let saveStatus: SaveStatus = 'notStarted';
  let completedRun = false;
  let finalElapsedMs = 0;
  // Play time is banked at each pause; `resumedAtMs` marks the current running stretch.
  let bankedMs = 0;
  let resumedAtMs = startedAtMs;
  let record: ScoreRecord | null = null;
  let previousBest = 0;

  const toDevice = (command: Promise<void> | undefined): void => {
    command?.catch(onDeviceError);
  };
  const elapsedMs = () => {
    if (status === 'finished') return finalElapsedMs;
    return bankedMs + (status === 'running' ? clock.now() - resumedAtMs : 0);
  };
  const timeIsUp = () => game.durationMs !== null && elapsedMs() >= game.durationMs;

  let resolveResult!: (record: ScoreRecord) => void;
  const result = new Promise<ScoreRecord>((resolve) => {
    resolveResult = resolve;
  });

  const session: GameSession = {
    score,
    getInput: () => device?.getState() ?? INITIAL_FIDGET_STATE,
    elapsedMs,
    feedback: (name) => toDevice(device?.feedback(name)),
    haptic: (...effects) => toDevice(device?.haptic(...effects)),
    showOnFidget: (line, text) => {
      if (useDisplay) toDevice(device?.showText(line, text));
    },
    showProgressOnFidget: (percent, label) => {
      if (useDisplay) toDevice(device?.showProgress(percent, label));
    },
    finish: () => end(true),
  };

  const logic = game.create(session);

  function flushToyPoints(): void {
    if (!pendingToyPoints || !device) return;
    toDevice(device.sendScoreEvent({ kind: 'points', ...pendingToyPoints }));
    pendingToyPoints = null;
    lastToyPointsMs = clock.now();
  }

  function publish(draft: ScoreEventDraft): void {
    const event: ScoreEvent = { ...draft, gameId: game.id, source: 'app' };
    scoreEvents.emit(event);
    options.onScoreEvent?.(event);
    if (!toyCelebrates || !device) return;
    if (draft.kind === 'points') {
      pendingToyPoints = { score: draft.score, value: (pendingToyPoints?.value ?? 0) + draft.value };
      if (clock.now() - lastToyPointsMs >= TOY_POINTS_EVENT_GAP_MS) flushToyPoints();
      return;
    }
    flushToyPoints();
    toDevice(device.sendScoreEvent(draft));
  }

  /** Turns score changes into events; call after anything that may have scored. */
  function checkScore(): void {
    if (!tracker) return;
    for (const draft of tracker.onScore(score.score)) publish(draft);
  }

  // The best so far decides when "new high score" fires; events start once it's known.
  repository
    .best(game.id)
    .catch(() => null)
    .then((best) => {
      tracker = createScoreEventTracker(best?.score ?? 0);
      publish(tracker.start());
      checkScore();
      if (status === 'finished') publish(tracker.end());
    });

  async function buildRecord(): Promise<ScoreRecord> {
    if (record) return record;
    const snapshot = score.snapshot();
    previousBest = (await repository.best(game.id))?.score ?? 0;
    record = createAppScoreRecord({
      gameId: game.id,
      deviceId: device?.info.deviceId ?? null,
      startedAtMs,
      durationMs: finalElapsedMs,
      snapshot,
      stars: starsFor(snapshot.score, game.starThresholds),
      completed: completedRun,
      newBest: snapshot.score > previousBest,
    });
    return record;
  }

  async function save(): Promise<ScoreRecord> {
    if (saveStatus === 'saved' && record) return record;
    saveStatus = 'saving';
    changes.emit();
    try {
      const saved = await buildRecord();
      await repository.save(saved); // same id every attempt, so a retry can never double-save
      saveStatus = 'saved';
      if (useDisplay) toDevice(device?.showScore({ score: saved.score, best: Math.max(previousBest, saved.score), stars: saved.stars }));
      // Toys with score events already celebrated the gameEnd event.
      if (completedRun && !toyCelebrates) toDevice(device?.feedback(saved.newBest ? 'celebrate' : 'success'));
      resolveResult(saved);
      return saved;
    } catch (error) {
      saveStatus = 'failed';
      throw error;
    } finally {
      changes.emit();
    }
  }

  function end(completed: boolean): void {
    if (status === 'finished') return;
    const elapsed = elapsedMs();
    finalElapsedMs = game.durationMs !== null && completed ? Math.min(elapsed, game.durationMs) : elapsed;
    status = 'finished';
    completedRun = completed;
    cancelTick();
    stopEvents();
    logic.onFinish?.();
    checkScore();  // e.g. partial credit added in onFinish
    if (tracker) publish(tracker.end());
    // Failure is visible as saveStatus 'failed'; retrySave() tries again. Either way, once
    // the score is on the toy, hand it back so the child can start Free Play while connected.
    save()
      .catch(() => undefined)
      .then(() => {
        if (useDisplay) toDevice(device?.setMode('standalone'));
      });
  }

  if (useDisplay) {
    toDevice(device?.setMode('app'));
    toDevice(device?.clearDisplay());
  }

  const stopEvents = device
    ? device.onEvent((event) => {
        if (status !== 'running') return;
        // Input that arrives after the deadline (a late tick) ends the game instead of scoring.
        if (timeIsUp()) {
          end(true);
          return;
        }
        logic.onEvent?.(event);
        checkScore();
        changes.emit();
      })
    : () => undefined;

  const cancelTick = scheduler.every(options.tickMs ?? DEFAULT_TICK_MS, () => {
    if (status !== 'running') return;
    const elapsed = elapsedMs();
    logic.onTick?.(elapsed);
    checkScore();
    if (clock.now() - lastToyPointsMs >= TOY_POINTS_EVENT_GAP_MS) flushToyPoints();
    if (timeIsUp()) end(true);
    else changes.emit();
  });

  logic.onStart?.();

  return {
    gameId: game.id,
    get status() {
      return status;
    },
    get saveStatus() {
      return saveStatus;
    },
    getState: () => logic.getState(),
    getScore: () => score.snapshot(),
    elapsedMs,
    remainingMs: () => (game.durationMs === null ? null : Math.max(0, game.durationMs - elapsedMs())),
    submit(action) {
      if (status !== 'running') return;
      if (timeIsUp()) {
        end(true);
        return;
      }
      logic.onAction?.(action);
      checkScore();
      changes.emit();
    },
    pause() {
      if (status !== 'running') return;
      if (timeIsUp()) {
        end(true);
        return;
      }
      bankedMs += clock.now() - resumedAtMs;
      status = 'paused';
      changes.emit();
    },
    resume() {
      if (status !== 'paused') return;
      resumedAtMs = clock.now();
      status = 'running';
      changes.emit();
    },
    subscribe: (listener) => changes.subscribe(listener),
    onScoreEvent: (listener) => scoreEvents.subscribe(listener),
    quit() {
      end(false);
      return result;
    },
    retrySave() {
      if (status !== 'finished') return Promise.reject(new Error('the game has not finished yet'));
      return save();
    },
    result,
  };
}
