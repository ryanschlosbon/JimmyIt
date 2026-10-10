import { defineGame, type GameSession } from '@jimmyit/game-sdk';

export const POINTS_FOR_DRAWING = 50;
/** Partial credit for an empty attempt: trying counts. */
export const POINTS_FOR_TRYING = 10;

/** Sent by the drawing view when the child taps "All done". */
export interface DrawingGameAction {
  readonly type: 'finish';
  readonly strokeCount: number;
}

export interface DrawingGameState {
  readonly finished: boolean;
  readonly strokeCount: number;
}

interface DrawingGameOptions {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

/**
 * Screen drawing with a finger, stylus or mouse; no toy needed. The view owns
 * the strokes (see drawing-model.ts) and submits the stroke count at the end.
 */
export function createDrawingGame(options: DrawingGameOptions) {
  return defineGame<DrawingGameState, DrawingGameAction>({
    ...options,
    skills: ['draw', 'stylus'],
    durationMs: null,
    needsToy: false,
    starThresholds: [POINTS_FOR_TRYING, 30, POINTS_FOR_DRAWING],

    create(session: GameSession) {
      let finished = false;
      let strokeCount = 0;
      return {
        getState: () => ({ finished, strokeCount }),
        onAction(action) {
          if (action.type !== 'finish' || finished) return;
          finished = true;
          strokeCount = Math.max(0, Math.floor(action.strokeCount));
          session.score.add(strokeCount > 0 ? POINTS_FOR_DRAWING : POINTS_FOR_TRYING);
          session.score.countAction(strokeCount);
          session.score.setMetric('strokeCount', strokeCount);
          session.finish();
        },
      };
    },
  });
}

export const freeDrawing = createDrawingGame({
  id: 'drawing-with-jimmy',
  title: 'Drawing with Jimmy',
  description: 'Pick a color. Make your mark. There’s no wrong way to create!',
});

export const shapeChallenge = createDrawingGame({
  id: 'shape-challenge',
  title: 'Shape challenge',
  description: 'Can you follow the circle? Take your time — every little try counts.',
});
