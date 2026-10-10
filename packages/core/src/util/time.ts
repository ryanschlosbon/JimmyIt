export type Cancel = () => void;

/** Injected wherever code needs "now", so tests can control time. */
export interface Clock {
  now(): number;
}

/** Injected wherever code needs timers, so tests can control time. */
export interface Scheduler {
  after(ms: number, task: () => void): Cancel;
  every(ms: number, task: () => void): Cancel;
}

// core is compiled without DOM or Node typings, so reach the host timers
// (React Native, browsers and Node all provide them) through a typed view.
interface TimerGlobals {
  setTimeout(task: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(task: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}
const timers = globalThis as unknown as TimerGlobals;

export const systemClock: Clock = { now: () => Date.now() };

export const systemScheduler: Scheduler = {
  after(ms, task) {
    const handle = timers.setTimeout(task, ms);
    return () => timers.clearTimeout(handle);
  },
  every(ms, task) {
    const handle = timers.setInterval(task, ms);
    return () => timers.clearInterval(handle);
  },
};

export interface ManualTime {
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  now(): number;
  /** Moves time forward, running every due task in order. */
  advance(ms: number): void;
}

/** Deterministic clock + scheduler for tests. */
export function createManualTime(startMs = 0): ManualTime {
  interface Task {
    id: number;
    at: number;
    intervalMs: number | null;
    run: () => void;
  }
  let now = startMs;
  let nextId = 1;
  const tasks = new Map<number, Task>();

  function schedule(ms: number, run: () => void, repeat: boolean): Cancel {
    if (!(ms >= 0) || (repeat && ms <= 0)) throw new RangeError(`bad timer interval ${ms}`);
    const task: Task = { id: nextId++, at: now + ms, intervalMs: repeat ? ms : null, run };
    tasks.set(task.id, task);
    return () => {
      tasks.delete(task.id);
    };
  }

  function nextDue(limit: number): Task | undefined {
    let best: Task | undefined;
    for (const task of tasks.values()) {
      if (task.at > limit) continue;
      if (!best || task.at < best.at || (task.at === best.at && task.id < best.id)) best = task;
    }
    return best;
  }

  const clock: Clock = { now: () => now };
  return {
    clock,
    scheduler: {
      after: (ms, task) => schedule(ms, task, false),
      every: (ms, task) => schedule(ms, task, true),
    },
    now: () => now,
    advance(ms) {
      const target = now + ms;
      for (let task = nextDue(target); task; task = nextDue(target)) {
        now = task.at;
        if (task.intervalMs === null) tasks.delete(task.id);
        else task.at += task.intervalMs;
        task.run();
      }
      now = target;
    },
  };
}
