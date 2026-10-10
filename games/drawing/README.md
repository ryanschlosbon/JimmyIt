# Drawing games

**Skills:** drawing with a finger, stylus or mouse. No toy needed (`needsToy: false`).

Two games share these rules:

| Export           | Game id              | Prompt                    |
| ---------------- | -------------------- | ------------------------- |
| `freeDrawing`    | `drawing-with-jimmy` | Free drawing              |
| `shapeChallenge` | `shape-challenge`    | Trace the circle          |

- The view keeps the strokes with `drawingReducer` (vector strokes, undo, clear)
  and draws them with `strokeToPath` (an SVG path).
- When the child taps "All done", the view calls
  `run.submit({ type: 'finish', strokeCount })`.
- 50 points for a drawing; 10 points of partial credit for an empty canvas.
  Stars: 10 / 30 / 50. Metric: `strokeCount`.

The `shape-recognition` game, which recognizes the drawn shape, can replace
`shapeChallenge` once it lands.
