import { describe, expect, it } from 'vitest';
import { createManualTime } from '@jimmyit/core';
import { createTimedChallenge, type TimedResult } from './timed-challenge';

describe('timed practice', () => {
  it('counts each kind of move only while running and completes exactly once', () => {
    const time = createManualTime(1_700_000_000_000);
    const challenge = createTimedChallenge(time);
    const results: TimedResult[] = [];
    challenge.onComplete(result => results.push(result));
    challenge.record('press');
    challenge.start(30_000);
    challenge.record('press'); challenge.record('spin'); challenge.record('squeeze');
    time.advance(30_000);
    challenge.record('press'); challenge.finish(); time.advance(30_000);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ durationMs: 30_000, actions: { press: 1, spin: 1, squeeze: 1 } });
    expect(challenge.getState().type).toBe('complete');
    expect(challenge.getResult()).toBe(results[0]);
  });

  it('pauses without consuming time or losing progress, then resumes', () => {
    const time = createManualTime(1_700_000_000_000);
    const challenge = createTimedChallenge(time);
    challenge.start(60_000);
    time.advance(10_000);
    challenge.record('spin'); challenge.pause();
    time.advance(3_600_000); challenge.record('spin');
    expect(challenge.getState()).toMatchObject({ type: 'paused', remainingMs: 50_000, actions: { spin: 1 } });
    challenge.resume(); time.advance(50_000);
    expect(challenge.getResult()).toMatchObject({ durationMs: 60_000, actions: { spin: 1 } });
  });

  it('keeps partial effort when finishing early and starts a fresh session on replay', () => {
    const time = createManualTime(1_700_000_000_000);
    const challenge = createTimedChallenge(time);
    challenge.start(30_000); time.advance(1200); challenge.record('press'); challenge.finish();
    const first = challenge.getResult();
    expect(first).toMatchObject({ durationMs: 1200, actions: { press: 1 } });
    challenge.start(90_000);
    expect(challenge.getState()).toMatchObject({ type: 'running', remainingMs: 90_000,
      actions: { press: 0, spin: 0, squeeze: 0 } });
    expect(challenge.getResult()).toBeNull();
    challenge.dispose();
  });

  it('rejects a late tap even if the timer callback is delayed by the app', () => {
    let now = 1000;
    const challenge = createTimedChallenge({ clock: { now: () => now },
      scheduler: { every: () => () => undefined, after: () => () => undefined } });
    challenge.start(1000); now = 2100; challenge.record('press');
    expect(challenge.getResult()).toMatchObject({ durationMs: 1000, actions: { press: 0 } });
  });
});
