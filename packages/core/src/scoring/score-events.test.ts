// Same cases as firmware/test testScoreEvents(): both sides must agree.
import { describe, expect, it } from 'vitest';
import { createScoreEventTracker, isNewBestAtEnd, scoreEventKindFromWire } from './score-events';

describe('score events', () => {
  it('reports points, each milestone, and beating the old best once', () => {
    const t = createScoreEventTracker(250);
    expect(t.start()).toEqual({ kind: 'gameStart', score: 0, value: 250 });
    expect(t.onScore(90)).toEqual([{ kind: 'points', score: 90, value: 90 }]);
    expect(t.onScore(90)).toEqual([]);
    expect(t.onScore(210)).toEqual([
      { kind: 'points', score: 210, value: 120 },
      { kind: 'milestone', score: 210, value: 100 },
    ]);
    expect(t.onScore(260)).toEqual([
      { kind: 'points', score: 260, value: 50 },
      { kind: 'newBest', score: 260, value: 250 },
    ]);
    expect(t.onScore(400)).toEqual([{ kind: 'points', score: 400, value: 140 }]); // 200, 300, 400 are not milestones
    expect(t.onScore(520)).toEqual([
      { kind: 'points', score: 520, value: 120 },
      { kind: 'milestone', score: 520, value: 500 },
    ]);
    expect(t.beatBest).toBe(true);
    expect(t.end()).toEqual({ kind: 'gameEnd', score: 520, value: 250 });
  });

  it('has nothing to beat on a first game, but the end still counts as a best', () => {
    const t = createScoreEventTracker(0);
    const milestones = (score: number) => t.onScore(score).filter((e) => e.kind === 'milestone').map((e) => e.value);
    expect(milestones(3200)).toEqual([100, 500, 1000, 1500, 2000, 3000]);
    expect(milestones(5000)).toEqual([4000, 5000]); // every 1000 after 3000
    expect(milestones(5999)).toEqual([]);
    expect(isNewBestAtEnd(t.end())).toBe(true);
  });

  it('maps wire kinds', () => {
    expect(scoreEventKindFromWire(4)).toBe('newBest');
    expect(scoreEventKindFromWire(9)).toBeNull();
  });
});
