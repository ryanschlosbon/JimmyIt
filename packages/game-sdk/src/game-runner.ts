import {
  type Clock,
  createAppScoreRecord,
  createEmitter,
  createScoreCounter,
  type Listener,
  type Scheduler,
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
  readonly device: GameDevice;
  readonly repository: ScoreRepository;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
  readonly tickMs?: number;
  /** Take over the toy's OLED during the game and show the result. Default true. */
  readonly useFidgetDisplay?: boolean;
  /** Toy commands are fire-and-forget during play; failures land here. */
  readonly onDeviceError?: (error: unknown) => void;
}

export type GameStatus = 'running' | 'finished';

/** One play of one game. The frontend's game screen holds this. */
export interface GameRun<TState, TAction = never> {
  readonly gameId: string;
  readonly status: GameStatus;
  getState(): TState;
  getScore(): ScoreSnapshot;
  elapsedMs(): number;
  /** Sends a game-specific action to the running game; ignored after completion. */
  submit(action: TAction): void;
  /** Called whenever state, score or status may have changed. */
  subscribe(listener: Listener<void>): Unsubscribe;
  /** Ends early because the child stopped; saved with completed = false. */
  quit(): Promise<ScoreRecord>;
  /** Resolves with the saved record once the game ends. */
  readonly result: Promise<ScoreRecord>;
}

const DEFAULT_TICK_MS = 50;

export function startGame<TState, TAction = never>(
  game: GameDefinition<TState, TAction>, options: StartGameOptions,
): GameRun<TState, TAction> {
  const { device, repository } = options;
  const clock = options.clock ?? systemClock;
  const scheduler = options.scheduler ?? systemScheduler;
  const useDisplay = options.useFidgetDisplay ?? true;
  const onDeviceError = options.onDeviceError ?? (() => undefined);

  const startedAtMs = clock.now();
  const score = createScoreCounter();
  const changes = createEmitter<void>();
  let status: GameStatus = 'running';
  let finalElapsedMs = 0;

  const toDevice = (command: Promise<void>): void => {
    command.catch(onDeviceError);
  };
  const elapsedMs = () => (status === 'running' ? clock.now() - startedAtMs : finalElapsedMs);

  let resolveResult!: (record: ScoreRecord) => void;
  let rejectResult!: (error: unknown) => void;
  const result = new Promise<ScoreRecord>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const session: GameSession = {
    score,
    getInput: () => device.getState(),
    elapsedMs,
    feedback: (name) => toDevice(device.feedback(name)),
    haptic: (...effects) => toDevice(device.haptic(...effects)),
    showOnFidget: (line, text) => {
      if (useDisplay) toDevice(device.showText(line, text));
    },
    showProgressOnFidget: (percent, label) => {
      if (useDisplay) toDevice(device.showProgress(percent, label));
    },
    finish: () => end(true),
  };

  const logic = game.create(session);

  async function saveResult(completed: boolean): Promise<ScoreRecord> {
    const snapshot = score.snapshot();
    const previousBest = (await repository.best(game.id))?.score ?? 0;
    const newBest = snapshot.score > previousBest;
    const stars = starsFor(snapshot.score, game.starThresholds);
    const record = createAppScoreRecord({
      gameId: game.id,
      deviceId: device.info.deviceId,
      startedAtMs,
      durationMs: finalElapsedMs,
      snapshot,
      stars,
      completed,
      newBest,
    });
    await repository.save(record);
    if (useDisplay) toDevice(device.showScore({ score: snapshot.score, best: Math.max(previousBest, snapshot.score), stars }));
    if (completed) toDevice(device.feedback(newBest ? 'celebrate' : 'success'));
    return record;
  }

  function end(completed: boolean): void {
    if (status !== 'running') return;
    const elapsed = clock.now() - startedAtMs;
    finalElapsedMs = game.durationMs !== null && completed ? Math.min(elapsed, game.durationMs) : elapsed;
    status = 'finished';
    cancelTick();
    stopEvents();
    logic.onFinish?.();
    saveResult(completed).then(resolveResult, rejectResult);
    changes.emit();
  }

  if (useDisplay) {
    toDevice(device.setMode('app'));
    toDevice(device.clearDisplay());
  }

  const stopEvents = device.onEvent((event) => {
    if (status !== 'running') return;
    logic.onEvent?.(event);
    changes.emit();
  });

  const cancelTick = scheduler.every(options.tickMs ?? DEFAULT_TICK_MS, () => {
    if (status !== 'running') return;
    const elapsed = elapsedMs();
    logic.onTick?.(elapsed);
    if (game.durationMs !== null && elapsed >= game.durationMs) end(true);
    else changes.emit();
  });

  logic.onStart?.();

  return {
    gameId: game.id,
    get status() {
      return status;
    },
    getState: () => logic.getState(),
    getScore: () => score.snapshot(),
    elapsedMs,
    submit(action) {
      if (status !== 'running') return;
      logic.onAction?.(action);
      changes.emit();
    },
    subscribe: (listener) => changes.subscribe(listener),
    quit() {
      end(false);
      return result;
    },
    result,
  };
}
