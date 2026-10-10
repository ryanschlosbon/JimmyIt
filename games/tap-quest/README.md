# Tap Quest

Tap Quest practices stylus control, hand-eye coordination, sequencing, and attention. It has four independent modes:

- **Precision:** touch each circle before its generous window ends. Near-edge touches earn partial credit.
- **Trace:** follow a cycle of eight gentle paths: horizontal, vertical, two diagonals,
  upward and downward arcs, a wave, and a chevron. Their positions shift around the
  play area while staying within its bounds. Five of seven path markers complete a trace.
- **Memory:** preview highlighted circles one at a time, then repeat the order using the visible choices. `replaySequence` offers another look.
- **Calm:** explore circles without a timer. The child chooses when to finish.

The view sends normalized `0..1` coordinates via `run.submit({ type: 'touch', phase: 'down' | 'move' | 'up', point })`.
It can draw `run.getState().target` or `path`, respect `paused`, and render the countdown and progress.
For Memory Mode, draw `target` only in the preview phase, and draw `choices` without a highlighted answer during recall.
`pause` and `resume` freeze game time. `restart` resets the target sequence while retaining earned points because scores never decrease.
To start a wholly fresh score, finish or quit the run and call `startGame` again.

`createTapQuestGame({ mode, level, recentAttempts, settings, feedback, patternSeed })` sets the challenge. A new
`patternSeed` changes the target order, memory sequence, and trace path while keeping a run reproducible.
The app can pass `patternPositions` from a validated generated level for the circle modes.
These centers are checked again against the game's adapted target radius before play.
Adaptation uses the
last five accuracy and completion rates and changes difficulty by at most one level. It makes no health inference.
In-game haptics default off; sounds are never required. When the toy is connected, the shared runner sends the
game's score moments (start, points, every 100, new high score, end) to the toy, which plays its own short animation
and haptic for each; there is no separate completion haptic. A future accessibility setting that turns all haptics
off would need a toy-side switch (protocol change).
No cloud service or device connection is needed for the rules (`needsToy: false`).
The standard game runner saves exactly one `ScoreRecord` per finished run through `ScoreRepository`. Each record
carries the metric `level`, so the app can continue at the child's level next time.

In the app: `apps/mobile/src/screens/TapQuestScreen.tsx` (mode picker, square play area, pause / finish) and
`tapQuestGame(mode, records, patternSeed)` in `apps/mobile/src/games.ts`, which starts at the child's last level for that mode and
passes their last five games to the adaptation. The runner's own `pause()` (used when the app goes to the background,
or when the stylus goes back into the toy) also freezes Tap Quest's timers.
