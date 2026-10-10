import { createShapeClassifier, type ShapeDrawing, type ShapePrediction, type TargetShape } from './shape-classifier';

/** A future adapter must load and validate a trained model before reporting ready. */
export interface ShapeModelAdapter {
  isReady(): boolean;
  predict(drawing: ShapeDrawing, target?: TargetShape): Promise<ShapePrediction>;
}

export interface ShapeRecognizer {
  predict(drawing: ShapeDrawing, target?: TargetShape): Promise<ShapePrediction>;
}

/** Uses the local geometry classifier whenever an optional trained adapter is absent or unavailable. */
export function createShapeRecognizer(model?: ShapeModelAdapter): ShapeRecognizer {
  const geometry = createShapeClassifier();
  return {
    async predict(drawing, target) {
      if (model?.isReady()) {
        try {
          return await model.predict(drawing, target);
        } catch {
          // Model integration is optional; a local drawing still receives feedback.
        }
      }
      return geometry.classify(drawing, target);
    },
  };
}

export interface ActivityRequest {
  readonly theme: 'calm' | 'nature' | 'space' | 'adventure';
  readonly target: TargetShape;
}

export interface ActivityContent {
  readonly instruction: string;
  readonly theme: ActivityRequest['theme'];
  readonly source: 'local' | 'optionalAi';
}

/** Implementations must keep child histories and API keys outside the mobile app. */
export interface ActivityContentAdapter {
  generate(request: ActivityRequest): Promise<ActivityContent>;
}

/** Safe on-device placeholder for optional themed content. */
export function createLocalActivityContentAdapter(): ActivityContentAdapter {
  return {
    async generate(request) {
      return { instruction: `Draw a ${request.target} at your own pace.`, theme: request.theme, source: 'local' };
    },
  };
}
