export interface ScoreSnapshot {
  readonly score: number;
  readonly actions: number;
  readonly metrics: Readonly<Record<string, number>>;
}

/** Running score for one game. Points only ever go up. */
export interface ScoreCounter {
  readonly score: number;
  readonly actions: number;
  /** Adds a non-negative integer number of points. */
  add(points: number): void;
  /** Counts interactions (presses, turns, squeezes) for the `actions` stat. */
  countAction(count?: number): void;
  setMetric(name: string, value: number): void;
  /** Keeps the larger of the current and new value, e.g. longest hold. */
  maxMetric(name: string, value: number): void;
  snapshot(): ScoreSnapshot;
}

function checkPoints(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${what} must be a non-negative integer, got ${value}`);
  }
}

function checkMetric(name: string, value: number): void {
  if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) throw new RangeError(`metric name must be camelCase, got "${name}"`);
  if (!Number.isFinite(value)) throw new RangeError(`metric ${name} must be finite, got ${value}`);
}

export function createScoreCounter(): ScoreCounter {
  let score = 0;
  let actions = 0;
  const metrics: Record<string, number> = {};
  return {
    get score() {
      return score;
    },
    get actions() {
      return actions;
    },
    add(points) {
      checkPoints(points, 'points');
      score += points;
    },
    countAction(count = 1) {
      checkPoints(count, 'action count');
      actions += count;
    },
    setMetric(name, value) {
      checkMetric(name, value);
      metrics[name] = value;
    },
    maxMetric(name, value) {
      checkMetric(name, value);
      const current = metrics[name];
      if (current === undefined || value > current) metrics[name] = value;
    },
    snapshot: () => ({ score, actions, metrics: { ...metrics } }),
  };
}
