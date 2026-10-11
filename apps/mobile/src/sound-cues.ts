// Decides which sound plays and when. The playing itself is a SoundBackend (expo-audio in the app, see
// sound-player.ts), installed at startup; until then, and in tests, nothing makes a noise.
import { type Clock, isNewBestAtEnd, type ScoreEvent, systemClock } from '@jimmyit/core';
import type { Reward } from '@jimmyit/app-kit';
import type { FeedbackName } from '@jimmyit/game-sdk';
import { FEEDBACK_SOUNDS, POP_SOUNDS, SOUNDS, type SoundName } from './design/sounds';

export interface SoundBackend {
  play(name: SoundName): void;
}

export interface SoundCues {
  /** Asks for a sound. Everything asked for in the same moment is settled together (see design/sounds.ts). */
  play(name: SoundName): void;
  feedback(name: FeedbackName): void;
  scoreEvent(event: ScoreEvent): void;
  reward(reward: Reward): void;
  /** Settings → Sounds. Off drops everything, including what is already waiting. */
  setEnabled(enabled: boolean): void;
  setBackend(backend: SoundBackend | null): void;
}

export interface SoundCueOptions {
  readonly clock?: Clock;
  /** Runs `flush` once the current moment's sounds are all in. Default: queueMicrotask. */
  readonly defer?: (flush: () => void) => void;
}

/** The sound for a score moment, or null. The toy's own games keep their start and points to themselves. */
export function scoreEventSound(event: ScoreEvent, nextPop: () => SoundName): SoundName | null {
  switch (event.kind) {
    case 'gameStart': return event.source === 'app' ? 'start' : null;
    case 'points': return event.source === 'app' ? nextPop() : null;
    case 'milestone': return 'milestone';
    case 'newBest': return 'celebrate';
    case 'gameEnd': return isNewBestAtEnd(event) ? 'celebrate' : 'finish';
  }
}

export function createSoundCues(options: SoundCueOptions = {}): SoundCues {
  const clock = options.clock ?? systemClock;
  const defer = options.defer ?? queueMicrotask;
  let backend: SoundBackend | null = null;
  let enabled = true;
  let waiting: SoundName[] = [];
  let pop = 0;
  const lastPlayedMs = new Map<SoundName, number>();
  let held: { priority: number; untilMs: number } | null = null;

  const allowed = (name: SoundName, now: number): boolean => {
    const style = SOUNDS[name];
    if (now - (lastPlayedMs.get(name) ?? Number.NEGATIVE_INFINITY) < style.gapMs) return false;
    return !(held && now < held.untilMs && style.priority > 0 && style.priority < held.priority);
  };

  const flush = (): void => {
    const asked = waiting;
    waiting = [];
    if (!enabled || !backend) return;
    const now = clock.now();
    // The first of the highest priority wins; the rest of the moment is dropped.
    const name = asked.filter((candidate) => allowed(candidate, now))
      .reduce<SoundName | null>((best, next) => (best && SOUNDS[best].priority >= SOUNDS[next].priority ? best : next), null);
    if (!name) return;
    lastPlayedMs.set(name, now);
    const { holdMs, priority } = SOUNDS[name];
    if (holdMs > 0) held = { priority, untilMs: now + holdMs };
    backend.play(name);
  };

  const play = (name: SoundName): void => {
    if (!enabled) return;
    if (waiting.length === 0) defer(flush);
    waiting.push(name);
  };

  const nextPop = (): SoundName => {
    const name = POP_SOUNDS[pop % POP_SOUNDS.length] ?? 'pop1';
    pop++;
    return name;
  };

  return {
    play,
    feedback: (name) => play(FEEDBACK_SOUNDS[name]),
    scoreEvent(event) {
      const name = scoreEventSound(event, nextPop);
      if (name) play(name);
    },
    reward: (reward) => play(reward.type === 'levelUp' ? 'levelUp' : 'badge'),
    setEnabled(next) {
      enabled = next;
      if (!next) waiting = [];
    },
    setBackend(next) {
      backend = next;
    },
  };
}

/** The app's one set of sound cues. Buttons, games and rewards all go through it. */
export const appSounds = createSoundCues();
