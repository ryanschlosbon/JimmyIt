import { createGameTestHarness } from '@jimmyit/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { analogToAxis, directionalToAxis, rotaryToAxis } from './knob-input';
import { createKnobQuestGame, createKnobQuestLevel, type KnobQuestLevel } from './knob-quest';

const level: KnobQuestLevel = {
  width: 40, height: 30, start: { x: 2, y: 22 },
  platforms: [{ x: 0, y: 26, width: 40, height: 4 }, { x: 12, y: 15, width: 10, height: 3 }],
  hazards: [{ x: 30, y: 22, width: 4, height: 4 }],
  gems: [{ x: 7, y: 21, width: 3, height: 3 }],
  goal: { x: 35, y: 20, width: 4, height: 6 },
};

describe('Knob Quest', () => {
  it('generates repeatable routes with harder environments', () => {
    expect(createKnobQuestLevel(17, 'normal')).toEqual(createKnobQuestLevel(17, 'normal'));
    expect(createKnobQuestLevel(18, 'normal').platforms).not.toEqual(createKnobQuestLevel(17, 'normal').platforms);
    const easy = createKnobQuestLevel(17, 'easy');
    const hard = createKnobQuestLevel(17, 'hard');
    expect(hard.width).toBeGreaterThan(easy.width);
    expect(hard.platforms[1]!.width).toBeLessThan(easy.platforms[1]!.width);
    expect(hard.hazards.length).toBeGreaterThan(easy.hazards.length);
    expect(hard.fireballs!.length).toBeGreaterThan(easy.fireballs!.length);
  });

  it('keeps the same movement on every difficulty; faster upward turns beat gravity', async () => {
    const flat = { ...level, hazards: [], gems: [], goal: { x: 35, y: 0, width: 3, height: 3 } };
    const easy = await createGameTestHarness(createKnobQuestGame(flat, 'easy'), { toy: false });
    const hard = await createGameTestHarness(createKnobQuestGame(flat, 'hard'), { toy: false });
    easy.run.submit(rotaryToAxis('vertical', -3));
    hard.run.submit(rotaryToAxis('vertical', -3));
    easy.advance(500);
    hard.advance(500);
    expect(hard.run.getState().y).toBe(easy.run.getState().y);
    const slow = await createGameTestHarness(createKnobQuestGame(flat), { toy: false });
    slow.run.submit(rotaryToAxis('vertical', -1));
    slow.advance(500);
    expect(easy.run.getState().y).toBeLessThan(slow.run.getState().y);
    const rising = easy.run.getState().y;
    easy.run.submit(rotaryToAxis('vertical', 0));
    easy.advance(500);
    expect(easy.run.getState().y).toBeLessThan(rising);
    const peak = easy.run.getState().y;
    easy.advance(500);
    expect(easy.run.getState().y).toBeGreaterThan(peak);
  });

  it('moves falling fireballs with game time and recovers at a reached checkpoint', async () => {
    const route = { ...level, hazards: [], gems: [], goal: { x: 35, y: 0, width: 3, height: 3 },
      checkpoint: { x: 8, y: 22 }, fireballs: [{ x: 15, phaseMs: 0, periodMs: 3000 }] };
    const h = await createGameTestHarness(createKnobQuestGame(route), { toy: false });
    const firstY = h.run.getState().fireballs[0]!.y;
    h.run.submit(directionalToAxis('horizontal', false, true));
    h.advance(250);
    expect(h.run.getState().checkpointReached).toBe(true);
    expect(h.run.getState().fireballs[0]!.y).toBeGreaterThan(firstY);
    h.advance(300);
    h.run.submit(directionalToAxis('horizontal', false, false));
    h.advance(1700);
    expect(h.run.getState().checkpoints).toBe(1);
    expect(h.run.getState().x).toBe(8);
  });
  it('normalizes directional, analog and rotary sources', () => {
    expect(directionalToAxis('horizontal', true, false).value).toBe(-1);
    expect(analogToAxis('vertical', 0.5).value).toBe(0);
    expect(analogToAxis('vertical', 1).value).toBe(1);
    expect(rotaryToAxis('horizontal', -3).value).toBe(-1);
  });

  it('moves in both axes, lands on platforms, and gathers gems', async () => {
    const h = await createGameTestHarness(createKnobQuestGame(level), { toy: false });
    h.run.submit(directionalToAxis('horizontal', false, true));
    h.advance(250);
    expect(h.run.getState().x).toBeGreaterThan(2);
    expect(h.run.getState().collected).toEqual([0]);
    h.run.submit(directionalToAxis('vertical', true, false));
    h.advance(500);
    expect(h.run.getState().y).toBeLessThan(22);
    expect(h.run.getState().x).toBeGreaterThan(7);
    h.run.submit(directionalToAxis('vertical', false, true));
    h.advance(500);
    expect(h.run.getState().y).toBeLessThanOrEqual(22);
    expect(h.run.getScore().score).toBe(30);
  });

  it('respects bounds and recovers from hazards', async () => {
    const h = await createGameTestHarness(createKnobQuestGame(level), { toy: false });
    h.run.submit(directionalToAxis('horizontal', true, false));
    h.advance(1_000);
    expect(h.run.getState().x).toBe(0);
    h.run.submit(directionalToAxis('horizontal', false, true));
    h.advance(1_500);
    expect(h.run.getState().checkpoints).toBeGreaterThan(0);
    expect(h.run.getScore().score).toBeGreaterThanOrEqual(0);
  });

  it('completes and saves a run at the goal', async () => {
    const direct = { ...level, hazards: [], platforms: [level.platforms[0]!], gems: [] };
    const h = await createGameTestHarness(createKnobQuestGame(direct), { toy: false });
    h.run.submit(directionalToAxis('horizontal', false, true));
    h.advance(1_800);
    expect((await h.run.result)).toMatchObject({ completed: true, score: 100,
      metrics: { gemCount: 0, checkpointCount: 0 } });
    const replay = await createGameTestHarness(createKnobQuestGame(direct), { toy: false });
    expect(replay.run.getState().x).toBe(2);
  });
});
