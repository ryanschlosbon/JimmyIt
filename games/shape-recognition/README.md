# Shape recognition building blocks

This package contains local, headless TypeScript logic. It adds no network access,
native dependencies, UI, or separate storage. Its classifier consumes touch strokes in
canvas coordinates and returns a shape plus a **geometric quality score**, not a
machine learning probability.

```ts
import { createShapeClassifier } from '@jimmyit/game-shape-recognition';

const result = createShapeClassifier().classify({
  width: 200,
  height: 200,
  strokes: [[
    { x: 30, y: 30 }, { x: 170, y: 30 },
    { x: 170, y: 170 }, { x: 30, y: 170 }, { x: 30, y: 30 },
  ]],
}, 'square');
// { shape: 'square', quality: 1, target: 'square', matchesTarget: true,
//   feedback: 'shapeMatched', algorithm: 'geometry-v1' }
```

The classifier validates canvas dimensions and coordinates. It normalizes by
canvas size, filters very short stray strokes, builds a convex outline, then
uses corner count, area, perimeter, circularity, radial variation, aspect ratio,
and closure. It accepts modest gaps and imperfect corners. Blank, tiny,
degenerate, or ambiguous input returns `unknown`. There is no star classifier.
For a multi-stroke drawing, pass all strokes in drawing order. This baseline is
best for one simple outline; it has not been evaluated against a labeled set of
children's drawings.

`analyzePattern(expected, actions)` returns ordered button accuracy, completion,
missed actions, and average press timing and hold duration. It does not retain
the actions. `recommendDifficulty(attempts, preferences)` considers the five
most recent completed attempts, changes difficulty by at most one step, and
respects the selected maximum and automatic-increase preference. Neither
function makes health or ability claims.

`createShapeRecognizer()` runs geometry locally. It accepts an optional
`ShapeModelAdapter`; that adapter must report ready only after loading and
validating a real trained model. Failed inference falls back to geometry.
There is currently **no trained model or ONNX runtime**. A future model workflow
should collect consented, de-identified drawings, split by participant before
training, report per-class recall and unknown rejection on held-out drawings,
and test inference on the target phone. Keep model preprocessing and class
order versioned with the trained weights. The included test covers fallback,
not model accuracy.

`ActivityContentAdapter` is an optional content interface.
`createLocalActivityContentAdapter()` provides deterministic instructions.
There is **no Gemini implementation, server, API key, or external call**. A
future Gemini proxy would need separate approval and must receive only
non-identifying activity parameters, never raw drawings or child histories.

## Integration boundary

The game SDK now has an additive `GameRun.submit(action)` hook. A host can create
`createShapeRecognitionGame({ targets: ['circle', 'square'] })`, pass it to
`startGame(game, { device, repository })`, then send each finished drawing as:

```ts
run.submit({
  type: 'submitDrawing',
  submissionId: 'unique-id-for-this-drawing',
  drawing: { width: 200, height: 200, strokes: [/* touch points */] },
});
```

The view reads `run.getState().target` and `run.getState().lastResult`, subscribes
to changes, and awaits `run.result` for the saved `ScoreRecord`. The app's
existing `ScoreRepository` is passed to `startGame`; the game never writes it
directly. Matching a target earns 20–30 points and advances the challenge.
A recognized other shape gets two effort points once per target and can be
retried. Unknown drawings earn no points and can be retried. The same
`submissionId` is ignored for the rest of that run, including after it ends.
The runner saves exactly one record on completion or quit. Default targets
are circle, triangle, and square. Callers may pass any non-empty sequence of
up to 20 supported targets. No user-facing text is selected by the game beyond
the toy's short display prompt; the frontend owns instructions and rendering.

It is a screen game (`needsToy: false`) and is listed in the app's catalog
(`apps/mobile/src/games.ts`) for scoreboards and the Shape Star badge. A drawing
screen for it belongs to the frontend owner; `preview/shape-recognition/` is a
local test page.

The boundary checker currently forbids one game importing another. To use
pattern and difficulty helpers from other games, their owner would need a
separately reviewed move into an allowed shared package and public export.

Run the repository's `npm run check` after dependencies are installed. No
environment variables are required.
