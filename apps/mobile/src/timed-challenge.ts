import { createEmitter, systemClock, systemScheduler, type Cancel, type Clock, type Scheduler,
  type Unsubscribe } from '@jimmyit/core';

export type ToyAction = 'press' | 'spin' | 'squeeze';
export interface TimedResult {
  readonly id: string;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly actions: Readonly<Record<ToyAction, number>>;
}
export interface TimedState {
  readonly type: 'ready' | 'running' | 'paused' | 'complete';
  readonly durationMs: number;
  readonly remainingMs: number;
  readonly actions: Readonly<Record<ToyAction, number>>;
}
export interface TimedChallenge {
  getState(): TimedState;
  getResult(): TimedResult | null;
  subscribe(listener: () => void): Unsubscribe;
  onComplete(listener: (result: TimedResult) => void): Unsubscribe;
  start(durationMs: number): void;
  record(action: ToyAction): void;
  pause(): void;
  resume(): void;
  finish(): void;
  dispose(): void;
}

/** Timer and counters are independent of UI and use injected time for deterministic tests. */
export function createTimedChallenge(options: { readonly clock?: Clock; readonly scheduler?: Scheduler } = {}): TimedChallenge {
  const clock = options.clock ?? systemClock;
  const scheduler = options.scheduler ?? systemScheduler;
  const changes = createEmitter<void>();
  const completions = createEmitter<TimedResult>();
  let state: TimedState = { type: 'ready', durationMs: 30_000, remainingMs: 30_000,
    actions: { press: 0, spin: 0, squeeze: 0 } };
  let result: TimedResult | null = null;
  let startedAtMs = 0;
  let deadlineMs = 0;
  let id = '';
  let cancelTick: Cancel | null = null;
  const update = (next: TimedState) => { state = next; changes.emit(); };
  const stop = () => { cancelTick?.(); cancelTick = null; };
  const finish = () => {
    if (state.type !== 'running' && state.type !== 'paused') return;
    const remainingMs = state.type === 'running' ? Math.max(0, deadlineMs - clock.now()) : state.remainingMs;
    stop();
    result = { id, startedAtMs, durationMs: state.durationMs - remainingMs, actions: { ...state.actions } };
    update({ ...state, type: 'complete', remainingMs });
    completions.emit(result);
  };
  const tick = () => {
    if (state.type !== 'running') return;
    const remainingMs = Math.max(0, deadlineMs - clock.now());
    if (remainingMs === 0) finish();
    else update({ ...state, remainingMs });
  };
  const runTimer = () => { deadlineMs = clock.now() + state.remainingMs; cancelTick = scheduler.every(200, tick); };
  return {
    getState: () => state,
    getResult: () => result,
    subscribe: listener => changes.subscribe(listener),
    onComplete: listener => completions.subscribe(listener),
    start(durationMs) {
      if (state.type === 'running' || state.type === 'paused') return;
      if (!Number.isInteger(durationMs) || durationMs < 1000) throw new RangeError('Choose a positive challenge duration');
      stop();
      startedAtMs = clock.now();
      id = `timed-${startedAtMs}-${Math.random().toString(36).slice(2)}`;
      result = null;
      update({ type: 'running', durationMs, remainingMs: durationMs, actions: { press: 0, spin: 0, squeeze: 0 } });
      runTimer();
    },
    record(action) {
      if (state.type !== 'running') return;
      // A late tap never extends or adds points after the deadline.
      if (clock.now() >= deadlineMs) { finish(); return; }
      update({ ...state, actions: { ...state.actions, [action]: state.actions[action] + 1 } });
    },
    pause() {
      if (state.type !== 'running') return;
      if (clock.now() >= deadlineMs) { finish(); return; }
      stop();
      update({ ...state, type: 'paused', remainingMs: Math.max(0, deadlineMs - clock.now()) });
    },
    resume() {
      if (state.type !== 'paused') return;
      update({ ...state, type: 'running' });
      runTimer();
    },
    finish,
    dispose: stop,
  };
}
