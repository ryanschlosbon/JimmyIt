import { describe, expect, it } from 'vitest';
import { createScoreCounter } from './score-counter';
import { createAppScoreRecord, ScoreRecordError, validateScoreRecord } from './score-records';
import { createCombo, pointsForDuration, proximityPoints, starsFor } from './scoring-helpers';

describe('score counter', () => {
  it('only accepts non-negative integer points', () => {
    const counter = createScoreCounter();
    counter.add(5);
    counter.add(0);
    expect(() => counter.add(-1)).toThrow(RangeError);
    expect(() => counter.add(1.5)).toThrow(RangeError);
    expect(counter.score).toBe(5);
  });

  it('tracks actions and metrics', () => {
    const counter = createScoreCounter();
    counter.countAction();
    counter.countAction(2);
    counter.maxMetric('longestHoldMs', 300);
    counter.maxMetric('longestHoldMs', 200);
    counter.setMetric('misses', 4);
    expect(() => counter.setMetric('Bad-Name', 1)).toThrow(RangeError);
    expect(counter.snapshot()).toEqual({ score: 0, actions: 3, metrics: { longestHoldMs: 300, misses: 4 } });
  });
});

describe('scoring helpers', () => {
  it('awards stars at thresholds', () => {
    expect([0, 9, 10, 25, 50, 999].map((s) => starsFor(s, [10, 25, 50]))).toEqual([0, 0, 1, 2, 3, 3]);
  });

  it('gives partial credit for getting close', () => {
    expect(proximityPoints({ value: 90, target: 90, tolerance: 30, maxPoints: 100 })).toBe(100);
    expect(proximityPoints({ value: 105, target: 90, tolerance: 30, maxPoints: 100 })).toBe(50);
    expect(proximityPoints({ value: 200, target: 90, tolerance: 30, maxPoints: 100 })).toBe(0);
  });

  it('counts whole points for duration', () => {
    expect(pointsForDuration(2_550, 10)).toBe(25);
  });

  it('grows the combo multiplier and resets it without penalty', () => {
    const combo = createCombo({ hitsPerStep: 2, maxMultiplier: 3 });
    expect([combo.hit(), combo.hit(), combo.hit(), combo.hit(), combo.hit(), combo.hit()]).toEqual([1, 1, 2, 2, 3, 3]);
    combo.reset();
    expect(combo.multiplier).toBe(1);
  });
});

describe('score records', () => {
  it('builds a valid app record', () => {
    const record = createAppScoreRecord(
      {
        gameId: 'spin-race',
        deviceId: '0000f1d6',
        startedAtMs: Date.UTC(2026, 9, 10, 12),
        durationMs: 30_000,
        snapshot: { score: 120, actions: 14, metrics: {} },
        stars: 2,
        completed: true,
        newBest: false,
      },
      () => 0.5,
    );
    expect(record.id).toBe(`app-spin-race-${Date.UTC(2026, 9, 10, 12)}-80000000`);
    expect(record.startedAt).toBe('2026-10-10T12:00:00.000Z');
  });

  it('rejects malformed records', () => {
    expect(() => validateScoreRecord({ id: 'x' })).toThrow(ScoreRecordError);
    expect(() => validateScoreRecord(null)).toThrow(ScoreRecordError);
  });
});
