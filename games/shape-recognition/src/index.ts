export {
  createShapeClassifier,
  ShapeDrawingError,
  type DrawingPoint,
  type ShapeDrawing,
  type ShapePrediction,
  type ShapeClassifier,
  type Shape,
  type TargetShape,
  type ShapeFeedback,
} from './shape-classifier';
export {
  createShapeRecognizer,
  createLocalActivityContentAdapter,
  type ShapeModelAdapter,
  type ShapeRecognizer,
  type ActivityRequest,
  type ActivityContent,
  type ActivityContentAdapter,
} from './adapters';
export {
  analyzePattern,
  recommendDifficulty,
  type PatternAction,
  type PatternAnalysis,
  type CompletedAttempt,
  type AccessibilityPreferences,
  type DifficultyRecommendation,
} from './pattern-analysis';
export {
  createShapeRecognitionGame,
  type ShapeRecognitionAction,
  type ShapeRecognitionOptions,
  type ShapeRecognitionState,
} from './shape-recognition';
