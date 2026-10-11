import { describe, expect, it } from 'vitest';
import { nextMilestoneAfter } from './milestones';

describe('milestones', () => {
  it('follows the list, then every 1000', () => {
    const reached: number[] = [];
    for (let m = nextMilestoneAfter(0); m <= 6000; m = nextMilestoneAfter(m)) reached.push(m);
    expect(reached).toEqual([100, 500, 1000, 1500, 2000, 3000, 4000, 5000, 6000]);
  });

  it('is strictly above the score', () => {
    expect(nextMilestoneAfter(99)).toBe(100);
    expect(nextMilestoneAfter(100)).toBe(500);
    expect(nextMilestoneAfter(2999)).toBe(3000);
    expect(nextMilestoneAfter(3000)).toBe(4000);
    expect(nextMilestoneAfter(12_345)).toBe(13_000);
  });
});
