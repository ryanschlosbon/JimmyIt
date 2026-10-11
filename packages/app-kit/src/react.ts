// React bindings for app-kit. Plain React (no React Native), so any design,
// on phone, tablet or web, can use them. Screens render; these hooks own state.
import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { type FidgetState, isNewBestAtEnd, type ScoreEvent, type ScoreRecord, type ScoreSnapshot } from '@jimmyit/core';
import type { GameDefinition, GameRun, GameStatus, SaveStatus } from '@jimmyit/game-sdk';
import type { CatalogEntry } from './catalog';
import type { ConnectionManager, ConnectionSnapshot } from './connection';
import { getProgress, type Progress } from './progress';
import { getScoreboard, type Scoreboard } from './scoreboard';
import type { Reward } from './rewards';
import type { JimmyServices } from './services';

const ServicesContext = createContext<JimmyServices | null>(null);

/** Put once near the app root: <JimmyServicesProvider services={services}>…</JimmyServicesProvider>. */
export function JimmyServicesProvider(props: { readonly services: JimmyServices; readonly children?: ReactNode }) {
  return createElement(ServicesContext.Provider, { value: props.services }, props.children);
}

export function useJimmyServices(): JimmyServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('wrap the app in <JimmyServicesProvider>');
  return services;
}

// ---- Connection -------------------------------------------------------------

export interface ConnectionControls extends ConnectionSnapshot {
  readonly connect: ConnectionManager['connect'];
  readonly disconnect: ConnectionManager['disconnect'];
  readonly clearError: ConnectionManager['clearError'];
  /** Disconnects and makes the toy ask the child "connect?" again next time (see JimmyServices.forgetToy). */
  readonly forget: JimmyServices['forgetToy'];
}

export function useConnection(): ConnectionControls {
  const { connection, forgetToy } = useJimmyServices();
  const snapshot = useSyncExternalStore(connection.subscribe, connection.getSnapshot, connection.getSnapshot);
  return { ...snapshot, connect: connection.connect, disconnect: connection.disconnect, clearError: connection.clearError,
    forget: forgetToy };
}

/** Live toy state (switches, spinner, screw, battery…), or null when no toy is connected. */
export function useToyState(): FidgetState | null {
  const { connection } = useJimmyServices();
  const client = useSyncExternalStore(connection.subscribe, connection.getClient, connection.getClient);
  const subscribe = useCallback(
    (listener: () => void) => (client ? client.onState(() => listener()) : () => undefined),
    [client],
  );
  const read = useCallback(() => client?.getState() ?? null, [client]);
  return useSyncExternalStore(subscribe, read, read);
}

// ---- Score events -------------------------------------------------------------

/**
 * Calls `listener` for every score moment: app games and games the toy plays by
 * itself while connected. Use it for sounds, confetti, mascot reactions…
 */
export function useScoreEvents(listener: (event: ScoreEvent) => void): void {
  const services = useJimmyServices();
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(() => services.onScoreEvent((event) => latest.current(event)), [services]);
}

/** The moments big enough for a full-screen celebration. */
export type CelebrationKind = 'milestone' | 'newBest' | 'bestAtEnd';

export interface Celebration {
  readonly kind: CelebrationKind;
  readonly event: ScoreEvent;
}

/**
 * The celebration to show right now, or null. A new high score (during play or
 * at the end) replaces a milestone; each clears itself after `durationMs`.
 */
export function useCelebration(options: { readonly durationMs?: number } = {}): Celebration | null {
  const durationMs = options.durationMs ?? 2600;
  const [current, setCurrent] = useState<Celebration | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useScoreEvents((event) => {
    const kind: CelebrationKind | null =
      event.kind === 'newBest' ? 'newBest' : event.kind === 'milestone' ? 'milestone' : isNewBestAtEnd(event) ? 'bestAtEnd' : null;
    if (!kind) return;
    setCurrent((showing) => (showing?.kind === 'newBest' && kind === 'milestone' ? showing : { kind, event }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCurrent(null), durationMs);
  });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return current;
}

// ---- Rewards ------------------------------------------------------------------

/**
 * The level-up or new badge to show right now, or null. Rewards earned together (a level and a badge from one game)
 * take turns, each for `durationMs`.
 */
export function useReward(options: { readonly durationMs?: number } = {}): Reward | null {
  const durationMs = options.durationMs ?? 3500;
  const services = useJimmyServices();
  const [current, setCurrent] = useState<Reward | null>(null);
  const queue = useRef<Reward[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const showNext = () => {
      const next = queue.current.shift() ?? null;
      setCurrent(next);
      timer.current = next ? setTimeout(showNext, durationMs) : null;
    };
    const stop = services.onReward((reward) => {
      queue.current.push(reward);
      if (!timer.current) showNext();
    });
    return () => {
      stop();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      queue.current = [];
    };
  }, [services, durationMs]);
  return current;
}

// ---- Scores -------------------------------------------------------------------

export interface ScoresView {
  /** Newest first. */
  readonly records: readonly ScoreRecord[];
  readonly progress: Progress;
  readonly scoreboard: Scoreboard;
  readonly loading: boolean;
  /** Set when saved scores could not be read; they are kept safe, never overwritten. */
  readonly error: unknown;
}

/** Saved scores plus derived levels, badges and scoreboard. Refreshes after every save or sync. */
export function useScores(options: { readonly games?: readonly CatalogEntry[] } = {}): ScoresView {
  const { repository } = useJimmyServices();
  const [records, setRecords] = useState<readonly ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      repository.list().then(
        (next) => {
          if (!active) return;
          setRecords(next);
          setError(null);
          setLoading(false);
        },
        (failure: unknown) => {
          if (!active) return;
          setError(failure);
          setLoading(false);
        },
      );
    };
    refresh();
    const stop = repository.onChange(refresh);
    return () => {
      active = false;
      stop();
    };
  }, [repository]);

  const progress = useMemo(() => getProgress(records), [records]);
  const scoreboard = useMemo(() => getScoreboard(records, { games: options.games ?? [] }), [records, options.games]);
  return { records, progress, scoreboard, loading, error };
}

// ---- Running a game ----------------------------------------------------------

export interface GameRunControls<TState, TAction> {
  readonly run: GameRun<TState, TAction> | null;
  /** 'idle' before start() and after clear(). */
  readonly status: GameStatus | 'idle';
  readonly saveStatus: SaveStatus;
  readonly state: TState | null;
  readonly score: ScoreSnapshot | null;
  readonly elapsedMs: number;
  readonly remainingMs: number | null;
  /** The saved record once the game has ended and saved. */
  readonly record: ScoreRecord | null;
  /** Starts a new run (quitting any unfinished one). Throws ToyNotConnectedError if the toy is needed. */
  start(game: GameDefinition<TState, TAction>, options?: { tickMs?: number }): GameRun<TState, TAction>;
  submit(action: TAction): void;
  pause(): void;
  resume(): void;
  /** Ends early, keeping every point (completed = false). */
  quit(): void;
  retrySave(): void;
  /** Forgets a finished run, back to 'idle'. */
  clear(): void;
}

/**
 * Runs one game at a time for a screen. Hold it in a component that stays
 * mounted for as long as the game should live; an unfinished game is quit
 * (and saved) when that component unmounts.
 */
export function useGameRun<TState, TAction = never>(): GameRunControls<TState, TAction> {
  const services = useJimmyServices();
  const [run, setRun] = useState<GameRun<TState, TAction> | null>(null);
  const [record, setRecord] = useState<ScoreRecord | null>(null);
  // GameRun state objects are rebuilt on every read, so re-render on a change counter instead.
  const version = useRef(0);
  const subscribe = useCallback(
    (listener: () => void) =>
      run
        ? run.subscribe(() => {
            version.current++;
            listener();
          })
        : () => undefined,
    [run],
  );
  const readVersion = useCallback(() => version.current, []);
  useSyncExternalStore(subscribe, readVersion, readVersion);

  useEffect(() => {
    if (!run) return undefined;
    let active = true;
    run.result.then((saved) => {
      if (active) setRecord(saved);
    });
    return () => {
      active = false;
      if (run.status !== 'finished') run.quit().catch(() => undefined);
    };
  }, [run]);

  const start = useCallback<GameRunControls<TState, TAction>['start']>(
    (game, options) => {
      const next = services.play(game, options);
      setRecord(null);
      setRun(next);
      return next;
    },
    [services],
  );

  // Stable per run, so screens can use them in effect dependencies.
  const submit = useCallback((action: TAction) => run?.submit(action), [run]);
  const pause = useCallback(() => run?.pause(), [run]);
  const resume = useCallback(() => run?.resume(), [run]);
  const quit = useCallback(() => {
    run?.quit().catch(() => undefined);
  }, [run]);
  const retrySave = useCallback(() => {
    run?.retrySave().catch(() => undefined);
  }, [run]);
  const clear = useCallback(() => {
    if (run && run.status !== 'finished') run.quit().catch(() => undefined);
    setRun(null);
    setRecord(null);
  }, [run]);

  return {
    run,
    status: run?.status ?? 'idle',
    saveStatus: run?.saveStatus ?? 'notStarted',
    state: run ? run.getState() : null,
    score: run ? run.getScore() : null,
    elapsedMs: run?.elapsedMs() ?? 0,
    remainingMs: run ? run.remainingMs() : null,
    record,
    start,
    submit,
    pause,
    resume,
    quit,
    retrySave,
    clear,
  };
}
