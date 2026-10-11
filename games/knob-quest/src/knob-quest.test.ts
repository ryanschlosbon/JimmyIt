import { createGameTestHarness } from '@jimmyit/game-sdk/testing';
import { describe, expect, it } from 'vitest';
import { analogToAxis, directionalToAxis, rotaryToAxis } from './knob-input';
import { createKnobQuestGame, createKnobQuestLevel, type KnobQuestLevel } from './knob-quest';

const level: KnobQuestLevel = {
  width: 40, height: 30, start: { x: 2, y: 22 },
  platforms: [{ x: 0, y: 26, width: 40, height: 4 }, { x: 12, y: 15, width: 10, height: 3 }],
  holes: [],
  goal: { x: 35, y: 0, width: 3, height: 3 },
};
// A hole from x 10 to 16; Jimmy (4 wide) drops through it.
const holey: KnobQuestLevel = {
  ...level,
  platforms: [{ x: 0, y: 26, width: 10, height: 4 }, { x: 16, y: 26, width: 24, height: 4 }],
  holes: [{ x: 10, y: 26, width: 6, height: 4 }],
};
const holeWidth = (route: KnobQuestLevel) => route.holes.reduce((total, hole) => total + hole.width, 0);
// A tall, open level, to see how high Jimmy can climb without bumping the top.
const tall: KnobQuestLevel = {
  width: 400, height: 100, start: { x: 2, y: 92 },
  platforms: [{ x: 0, y: 96, width: 400, height: 4 }],
  holes: [],
  goal: { x: 395, y: 0, width: 3, height: 3 },
};
const lift = (value: number) => ({ type: 'axis' as const, axis: 'vertical' as const, value: -value });

/** Holds the lift at `strength` from the floor of `tall` until Jimmy lands again; returns how high he climbed. */
async function jump(strength: number, { glide = true } = {}) {
  const h = await createGameTestHarness(createKnobQuestGame(tall), { toy: false });
  h.run.submit(lift(strength));
  let top = tall.start.y;
  let airborneMs = 0;
  let lowestBoost = 1;
  for (let t = 0; t < 10_000; t += 40) {
    h.advance(40);
    const state = h.run.getState();
    top = Math.min(top, state.y);
    lowestBoost = Math.min(lowestBoost, state.boost);
    if (!glide && state.verticalVelocity > 0) h.run.submit(lift(0));
    if (!state.grounded) airborneMs += 40;
    else if (airborneMs > 0) break;
  }
  return { climb: tall.start.y - top, airborneMs, lowestBoost, landed: h.run.getState() };
}

describe('Knob Quest', () => {
  it('generates repeatable routes; holes grow from none (easy) to small (normal) to big (hard)', () => {
    expect(createKnobQuestLevel(17, 'normal')).toEqual(createKnobQuestLevel(17, 'normal'));
    expect(createKnobQuestLevel(18, 'normal').platforms).not.toEqual(createKnobQuestLevel(17, 'normal').platforms);
    const easy = createKnobQuestLevel(17, 'easy');
    const normal = createKnobQuestLevel(17, 'normal');
    const hard = createKnobQuestLevel(17, 'hard');
    expect(hard.width).toBeGreaterThan(easy.width);
    expect(easy.holes).toEqual([]);
    expect(normal.holes.length).toBeGreaterThan(0);
    expect(Math.max(...hard.holes.map(hole => hole.width))).toBeGreaterThan(Math.max(...normal.holes.map(hole => hole.width)));
    expect(holeWidth(hard)).toBeGreaterThan(holeWidth(normal));
    // Hard has a stretch with no floor longer than any single platform, so the platforms are the way across.
    expect(Math.max(...hard.holes.map(hole => hole.width))).toBeGreaterThan(40);
    expect(hard.fireballs!.length).toBeGreaterThan(easy.fireballs!.length);
  });

  it('never cuts a hole under the start or the checkpoint', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      for (let seed = 1; seed < 20; seed++) {
        const route = createKnobQuestLevel(seed, difficulty);
        for (const hole of route.holes) {
          expect(hole.x).toBeGreaterThan(route.start.x + 4);
        }
      }
    }
  });

  it('keeps the same movement on every difficulty; faster upward turns beat gravity', async () => {
    const easy = await createGameTestHarness(createKnobQuestGame(level, 'easy'), { toy: false });
    const hard = await createGameTestHarness(createKnobQuestGame(level, 'hard'), { toy: false });
    easy.run.submit(rotaryToAxis('vertical', -3));
    hard.run.submit(rotaryToAxis('vertical', -3));
    easy.advance(500);
    hard.advance(500);
    expect(hard.run.getState().y).toBe(easy.run.getState().y);
    const slow = await createGameTestHarness(createKnobQuestGame(level), { toy: false });
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

  it('spends boost to lift, so holding the lift forever still brings Jimmy back down', async () => {
    const { climb, lowestBoost, landed } = await jump(1);
    expect(lowestBoost).toBe(0);
    expect(climb).toBeGreaterThan(30);
    expect(climb).toBeLessThan(45);
    // Landing fills the boost again.
    expect(landed).toMatchObject({ grounded: true, boost: 1, y: tall.start.y });
  });

  it('jumps higher the harder the knob is turned', async () => {
    const strong = await jump(1);
    const medium = await jump(0.7);
    const gentle = await jump(0.5);
    expect(strong.climb).toBeGreaterThan(medium.climb);
    expect(medium.climb).toBeGreaterThan(gentle.climb);
    expect(gentle.climb).toBeGreaterThan(5);
  });

  it('falls faster with no lift on the way down, and glides with a fast one', async () => {
    const dropped = await jump(1, { glide: false });
    const glided = await jump(1);
    expect(glided.climb).toBeCloseTo(dropped.climb, 0);
    expect(glided.airborneMs).toBeGreaterThan(dropped.airborneMs + 600);
  });

  it('keeps every platform within a strong jump of the floor below, and of the platform before it', async () => {
    let highestFromFloor = 0;
    let highestStep = 0;
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      for (let seed = 1; seed < 40; seed++) {
        const route = createKnobQuestLevel(seed, difficulty);
        const floorTop = route.height - 4;
        const floating = route.platforms.filter((platform) => platform.y < floorTop);
        floating.forEach((platform, index) => {
          highestFromFloor = Math.max(highestFromFloor, floorTop - platform.y);
          const before = floating[index - 1];
          if (before) highestStep = Math.max(highestStep, before.y - platform.y);
        });
      }
    }
    expect((await jump(0.8)).climb).toBeGreaterThan(highestFromFloor + 1);
    expect((await jump(0.55)).climb).toBeGreaterThan(highestStep + 1);
  });

  it('pays once for each platform Jimmy lands on, and records the takeoff and landing', async () => {
    const h = await createGameTestHarness(createKnobQuestGame(level), { toy: false });
    h.run.submit(directionalToAxis('vertical', true, false));
    h.advance(800);
    expect(h.run.getState().grounded).toBe(false);
    expect(h.run.getState().jumpedAtMs).toBeGreaterThan(0);
    h.run.submit(directionalToAxis('vertical', false, false));
    h.run.submit(directionalToAxis('horizontal', false, true));
    h.advance(400);
    h.run.submit(directionalToAxis('horizontal', false, false));
    h.advance(2_000);
    const state = h.run.getState();
    expect(state.grounded).toBe(true);
    expect(state.y).toBe(11);
    expect(state.visited).toEqual([1]);
    expect(state.landedAtMs).toBeGreaterThan(state.jumpedAtMs);
    expect(h.run.getScore().score).toBe(20);
    h.advance(1_000);
    expect(h.run.getScore().score).toBe(20);
  });

  it('a fall costs a life and Jimmy comes back at the checkpoint, keeping every point', async () => {
    const h = await createGameTestHarness(createKnobQuestGame({ ...holey, checkpoint: { x: 6, y: 22 } }), { toy: false });
    h.run.submit(directionalToAxis('horizontal', false, true));
    h.advance(250);
    expect(h.run.getState().checkpointReached).toBe(true);
    expect(h.run.getScore().score).toBe(50);
    h.advance(1_500);
    expect(h.run.getState()).toMatchObject({ lives: 2, restarts: 1, x: 6, y: 22 });
    expect(h.run.getScore().score).toBe(50);
  });

  it('ends the run gently after the last life, keeping the score', async () => {
    const h = await createGameTestHarness(createKnobQuestGame({ ...holey, checkpoint: { x: 6, y: 22 } }), { toy: false });
    for (let fall = 0; fall < 3; fall++) {
      h.run.submit(directionalToAxis('horizontal', false, true));
      h.advance(1_800);
    }
    expect(h.run.getState()).toMatchObject({ lives: 0, outOfLives: true, completed: false });
    expect(await h.run.result).toMatchObject({ score: 50,
      metrics: { restartCount: 3, livesLeftCount: 0 } });
  });

  it('bumping a fireball also costs a life', async () => {
    const route = { ...level, fireballs: [{ x: 15, phaseMs: 0, periodMs: 3000 }] };
    const h = await createGameTestHarness(createKnobQuestGame(route), { toy: false });
    const firstY = h.run.getState().fireballs[0]!.y;
    h.advance(250);
    expect(h.run.getState().fireballs[0]!.y).toBeGreaterThan(firstY);
    h.run.submit(directionalToAxis('horizontal', false, true));
    h.advance(500);
    h.run.submit(directionalToAxis('horizontal', false, false));
    h.advance(1_700);
    expect(h.run.getState().lives).toBe(2);
    expect(h.run.getState().x).toBe(2);
  });

  it('plays with the real toy: spinning faster rolls farther, and the screw lifts Jimmy', async () => {
    const roll = async (degreesPerStep: number) => {
      const h = await createGameTestHarness(createKnobQuestGame({ ...level, platforms: [level.platforms[0]!] }));
      for (let i = 0; i < 10; i++) {
        h.fidget.spin(degreesPerStep);
        h.advance(100);
      }
      return h.run.getState().x;
    };
    const slow = await roll(20);
    const fast = await roll(45);
    expect(slow).toBeGreaterThan(2);
    expect(fast).toBeGreaterThan(slow);
    expect(await roll(-45)).toBe(0);

    const h = await createGameTestHarness(createKnobQuestGame(level));
    for (let i = 0; i < 10; i++) {
      h.fidget.turnScrew(1);
      h.advance(100);
    }
    expect(h.run.getState().y).toBeLessThan(22);
  });

  it('normalizes directional, analog and rotary sources', () => {
    expect(directionalToAxis('horizontal', true, false).value).toBe(-1);
    expect(analogToAxis('vertical', 0.5).value).toBe(0);
    expect(analogToAxis('vertical', 1).value).toBe(1);
    expect(rotaryToAxis('horizontal', -3).value).toBe(-1);
  });

  it('respects the level edges', async () => {
    const h = await createGameTestHarness(createKnobQuestGame(level), { toy: false });
    h.run.submit(directionalToAxis('horizontal', true, false));
    h.advance(1_000);
    expect(h.run.getState().x).toBe(0);
  });

  it('completes and saves a run at the goal', async () => {
    const direct = { ...level, platforms: [level.platforms[0]!], goal: { x: 35, y: 20, width: 4, height: 6 } };
    const h = await createGameTestHarness(createKnobQuestGame(direct), { toy: false });
    h.run.submit(directionalToAxis('horizontal', false, true));
    h.advance(1_800);
    expect((await h.run.result)).toMatchObject({ completed: true, score: 100,
      metrics: { platformCount: 0, restartCount: 0, livesLeftCount: 3 } });
    const replay = await createGameTestHarness(createKnobQuestGame(direct), { toy: false });
    expect(replay.run.getState().x).toBe(2);
  });
});
