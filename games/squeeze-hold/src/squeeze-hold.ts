import { defineGame, type GameSession } from '@jimmyit/game-sdk';

/** Squeeze level band the child aims for, 0-1. */
const TARGET = { min: 0.4, max: 0.7 } as const;
const DURATION_MS = 30_000;
const POINTS_PER_SECOND_IN_BAND = 10;

export interface SqueezeHoldState {
  readonly level: number;
  readonly target: { readonly min: number; readonly max: number };
  readonly inBand: boolean;
  readonly currentHoldMs: number;
  readonly timeLeftMs: number;
  readonly score: number;
}

/**
 * Squeeze & Hold: keep the squeeze inside the target band. Points accrue for
 * every moment in the band; leaving it only ends the current hold.
 */
export const squeezeHold = defineGame<SqueezeHoldState>({
  id: 'squeeze-hold',
  title: 'Squeeze & Hold',
  description: 'Squeeze just right and hold it steady.',
  skills: ['squeeze'],
  durationMs: DURATION_MS,
  starThresholds: [50, 120, 200],

  create(session: GameSession) {
    let lastTickMs = 0;
    let inBandMs = 0;
    let currentHoldMs = 0;
    let elapsedMs = 0;

    const levelInBand = (level: number) => level >= TARGET.min && level <= TARGET.max;

    return {
      getState() {
        const level = session.getInput().squeeze.level;
        return {
          level,
          target: TARGET,
          inBand: levelInBand(level),
          currentHoldMs,
          timeLeftMs: Math.max(0, DURATION_MS - elapsedMs),
          score: session.score.score,
        };
      },

      onStart() {
        session.showOnFidget(0, 'Squeeze & Hold');
      },

      onEvent(event) {
        if (event.type === 'squeezeStart') session.score.countAction();
      },

      onTick(now) {
        const stepMs = now - lastTickMs;
        lastTickMs = now;
        elapsedMs = now;
        if (!levelInBand(session.getInput().squeeze.level)) {
          currentHoldMs = 0;
          return;
        }
        const wholeSecondsBefore = Math.floor(currentHoldMs / 1000);
        currentHoldMs += stepMs;
        session.score.maxMetric('longestHoldMs', currentHoldMs);
        if (Math.floor(currentHoldMs / 1000) > wholeSecondsBefore) session.feedback('tick');

        const pointsBefore = Math.floor((inBandMs / 1000) * POINTS_PER_SECOND_IN_BAND);
        inBandMs += stepMs;
        const pointsNow = Math.floor((inBandMs / 1000) * POINTS_PER_SECOND_IN_BAND);
        session.score.add(pointsNow - pointsBefore);
      },

      onFinish() {
        session.score.setMetric('inBandMs', inBandMs);
      },
    };
  },
});
