import { createToyActionTracker, defineGame, type GameSession, TOY_ACTIONS, type ToyAction } from '@jimmyit/game-sdk';

export const TIMED_PRACTICE_ID = 'timed-motor-practice';
export const TIMED_PRACTICE_DURATIONS_MS = [30_000, 60_000, 90_000] as const;
export const POINTS_PER_MOVE = 5;
/** Partial credit: any attempt, even with no moves, earns at least this much. */
export const MINIMUM_POINTS = 10;

/**
 * Metric name saved for each kind of move. buttonPressCount and spinCount keep
 * the names the first app version used, so older records still count toward badges.
 */
export const MOVE_METRICS: Readonly<Record<ToyAction, string>> = {
  press: 'buttonPressCount',
  spin: 'spinCount',
  screw: 'screwTurnCount',
  slide: 'slideCount',
  toggle: 'rockerToggleCount',
  stylus: 'stylusCount',
};

export interface TimedPracticeState {
  readonly moves: Readonly<Record<ToyAction, number>>;
  readonly totalMoves: number;
  readonly lastMove: ToyAction | null;
  readonly score: number;
}

function noMoves(): Record<ToyAction, number> {
  return Object.fromEntries(TOY_ACTIONS.map((action) => [action, 0])) as Record<ToyAction, number>;
}

/**
 * Timed toy practice: every move on the toy (press, spin, screw, slide,
 * rocker, stylus) earns points until time runs out.
 */
export function createTimedPractice(durationMs: number = TIMED_PRACTICE_DURATIONS_MS[0]) {
  return defineGame<TimedPracticeState>({
    id: TIMED_PRACTICE_ID,
    title: 'Timed toy practice',
    description: 'Go at your own pace. Every move counts.',
    skills: TOY_ACTIONS,
    durationMs,
    starThresholds: [10, 50, 100],

    create(session: GameSession) {
      const tracker = createToyActionTracker();
      const moves = noMoves();
      let totalMoves = 0;
      let lastMove: ToyAction | null = null;

      return {
        getState: () => ({ moves: { ...moves }, totalMoves, lastMove, score: session.score.score }),

        onEvent(event) {
          for (const move of tracker.onEvent(event)) {
            moves[move]++;
            totalMoves++;
            lastMove = move;
            session.score.add(POINTS_PER_MOVE);
            session.score.countAction();
          }
        },

        onFinish() {
          if (session.score.score < MINIMUM_POINTS) session.score.add(MINIMUM_POINTS - session.score.score);
          for (const action of TOY_ACTIONS) session.score.setMetric(MOVE_METRICS[action], moves[action]);
        },
      };
    },
  });
}
