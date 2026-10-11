import { describe, expect, it } from 'vitest';
import { createManualTime, type ScoreEvent } from '@jimmyit/core';
import { createSoundCues } from './sound-cues';
import type { SoundName } from './design/sounds';

function setup() {
  const time = createManualTime(0);
  const pending: (() => void)[] = [];
  const played: SoundName[] = [];
  const cues = createSoundCues({ clock: time.clock, defer: (flush) => pending.push(flush) });
  cues.setBackend({ play: (name) => played.push(name) });
  /** Ends the current moment: what was asked for in it gets settled. */
  const settle = () => pending.splice(0).forEach((flush) => flush());
  return { time, cues, played, settle };
}

const event = (kind: ScoreEvent['kind'], score: number, value: number, source: ScoreEvent['source'] = 'app'): ScoreEvent =>
  ({ kind, score, value, source, gameId: 'test' });

describe('sound cues', () => {
  it('plays one sound per moment: the biggest', () => {
    const { cues, played, settle } = setup();
    cues.scoreEvent(event('points', 120, 40));
    cues.scoreEvent(event('milestone', 120, 100));
    cues.scoreEvent(event('newBest', 120, 100));
    settle();
    expect(played).toEqual(['celebrate']);
  });

  it('takes the pop pitches in turn and never repeats one too fast', () => {
    const { cues, played, settle, time } = setup();
    for (let i = 0; i < 4; i++) {
      cues.scoreEvent(event('points', i + 1, 1));
      settle();
      time.advance(100);
    }
    expect(played).toEqual(['pop1', 'pop2', 'pop3', 'pop1']);

    cues.play('tick');
    settle();
    time.advance(10);
    cues.play('tick');
    settle();
    expect(played.filter((name) => name === 'tick')).toHaveLength(1);
  });

  it('lets a celebration ring before game sounds come back, but always answers a button', () => {
    const { cues, played, settle, time } = setup();
    cues.scoreEvent(event('newBest', 50, 40));
    settle();
    time.advance(100);
    cues.scoreEvent(event('points', 51, 1));
    settle();
    cues.play('click');
    settle();
    expect(played).toEqual(['celebrate', 'click']);

    time.advance(1_000);
    cues.scoreEvent(event('points', 52, 1));
    settle();
    expect(played.at(-1)).toMatch(/^pop/);
  });

  it('maps game feedback, rewards and game ends to their sounds', () => {
    const { cues, played, settle, time } = setup();
    const moments: (() => void)[] = [
      () => cues.feedback('success'),
      () => cues.feedback('nudge'),
      () => cues.scoreEvent(event('gameEnd', 30, 80)),
      () => cues.scoreEvent(event('gameEnd', 90, 80)),
      () => cues.reward({ type: 'levelUp', level: 2 }),
      () => cues.reward({ type: 'badge', badgeId: 'first' }),
    ];
    for (const moment of moments) {
      moment();
      settle();
      time.advance(2_000);
    }
    expect(played).toEqual(['success', 'nudge', 'finish', 'celebrate', 'levelUp', 'badge']);
  });

  it('leaves the start and points of the toy’s own games to the toy', () => {
    const { cues, played, settle } = setup();
    cues.scoreEvent(event('gameStart', 0, 0, 'toy'));
    cues.scoreEvent(event('points', 1, 1, 'toy'));
    settle();
    expect(played).toEqual([]);
  });

  it('is silent when sounds are off, even for what was already waiting', () => {
    const { cues, played, settle } = setup();
    cues.play('click');
    cues.setEnabled(false);
    cues.play('success');
    settle();
    expect(played).toEqual([]);
    cues.setEnabled(true);
    cues.play('success');
    settle();
    expect(played).toEqual(['success']);
  });
});
