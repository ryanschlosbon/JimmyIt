import { defineGame, type GameSession } from '@jimmyit/game-sdk';
import { createShapeClassifier, type ShapeDrawing, type ShapePrediction, type TargetShape } from './shape-classifier';

const DEFAULT_TARGETS: readonly TargetShape[] = ['circle', 'triangle', 'square'];
const VALID_TARGETS: readonly TargetShape[] = ['circle', 'triangle', 'square', 'rectangle'];

export interface ShapeRecognitionAction {
  readonly type: 'submitDrawing';
  /** Stable within one run so a repeated event cannot earn points twice. */
  readonly submissionId: string;
  readonly drawing: ShapeDrawing;
  /** Optional result from the host's asynchronous model adapter. */
  readonly prediction?: ShapePrediction;
}

export interface ShapeRecognitionState {
  readonly target: TargetShape | null;
  readonly challengeIndex: number;
  readonly challengeCount: number;
  readonly matchedCount: number;
  readonly submissions: number;
  readonly lastResult: ShapePrediction | null;
  readonly score: number;
  readonly completed: boolean;
}

export interface ShapeRecognitionOptions {
  /** Fixed sequence for this session; default is circle, triangle, square. */
  readonly targets?: readonly TargetShape[];
}

/** Creates headless shape game rules; startGame owns the score record and repository save. */
export function createShapeRecognitionGame(options: ShapeRecognitionOptions = {}) {
  const targets = [...(options.targets ?? DEFAULT_TARGETS)];
  if (targets.length === 0 || targets.length > 20 || targets.some((target) => !VALID_TARGETS.includes(target))) {
    throw new RangeError('shape game needs between 1 and 20 supported targets');
  }
  const classifier = createShapeClassifier();
  return defineGame<ShapeRecognitionState, ShapeRecognitionAction>({
    id: 'shape-recognition',
    title: 'Shape Recognition',
    description: 'Draw each shape at your own pace.',
    skills: ['stylus'],
    durationMs: null,
    needsToy: false, // screen game: plays with or without the toy connected
    starThresholds: [10 * targets.length, 20 * targets.length, 28 * targets.length],

    create(session: GameSession) {
      let challengeIndex = 0;
      let matchedCount = 0;
      let submissions = 0;
      let lastResult: ShapePrediction | null = null;
      let completed = false;
      let effortAwardedForChallenge = false;
      const seen = new Set<string>();

      return {
        getState(): ShapeRecognitionState {
          return {
            target: targets[challengeIndex] ?? null,
            challengeIndex,
            challengeCount: targets.length,
            matchedCount,
            submissions,
            lastResult,
            score: session.score.score,
            completed,
          };
        },

        onStart() {
          session.showOnFidget(0, 'Draw a shape');
          session.showProgressOnFidget(0);
        },

        onAction(action) {
          if (action.type !== 'submitDrawing' || !action.submissionId.trim()) {
            throw new RangeError('shape submission needs an ID and drawing');
          }
          if (seen.has(action.submissionId)) return;
          const target = targets[challengeIndex];
          if (!target) return;
          const supplied = action.prediction;
          if (supplied && (!Number.isFinite(supplied.quality) || supplied.quality < 0 || supplied.quality > 1)) {
            throw new RangeError('shape prediction quality is invalid');
          }
          const result = supplied ? {
            ...supplied,
            target,
            matchesTarget: supplied.shape === target,
            feedback: supplied.shape === 'unknown' ? 'drawMore' as const
              : supplied.shape === target ? 'shapeMatched' as const : 'keepTrying' as const,
          } : classifier.classify(action.drawing, target);
          seen.add(action.submissionId);
          submissions++;
          session.score.countAction();
          lastResult = result;
          if (result.matchesTarget) {
            session.score.add(20 + Math.floor(result.quality * 10));
            matchedCount++;
            challengeIndex++;
            effortAwardedForChallenge = false;
            session.feedback('success');
            session.showProgressOnFidget(Math.round(100 * matchedCount / targets.length));
            if (challengeIndex === targets.length) {
              completed = true;
              session.finish();
            }
          } else if (result.shape !== 'unknown') {
            if (!effortAwardedForChallenge) {
              session.score.add(2);
              effortAwardedForChallenge = true;
            }
            session.feedback('nudge');
          }
        },

        onFinish() {
          session.score.setMetric('matchedShapes', matchedCount);
          session.score.setMetric('drawingSubmissions', submissions);
        },
      };
    },
  });
}
