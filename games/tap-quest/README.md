# Tap Quest

Tap Quest practices stylus control, hand-eye coordination, sequencing, and attention. It has four independent modes:

- **Precision:** touch each circle before its generous window ends. Near-edge touches earn partial credit.
- **Trace:** follow alternating straight and curved paths. Five of seven path markers complete a trace.
- **Memory:** preview highlighted circles one at a time, then repeat the order using the visible choices. `replaySequence` offers another look.
- **Calm:** explore circles without a timer. The child chooses when to finish.

The view sends normalized `0..1` coordinates via `run.submit({ type: 'touch', phase: 'down' | 'move' | 'up', point })`.
It can draw `run.getState().target` or `path`, respect `paused`, and render the countdown and progress.
For Memory Mode, draw `target` only in the preview phase, and draw `choices` without a highlighted answer during recall.
`pause` and `resume` freeze game time. `restart` resets the target sequence while retaining earned points because scores never decrease.
To start a wholly fresh score, finish or quit the run and call `startGame` again.

`createTapQuestGame({ mode, level, recentAttempts, settings, feedback })` sets the challenge. Adaptation uses the
last five accuracy and completion rates and changes difficulty by at most one level. It makes no health inference.
In-game haptics default off; sounds are never required. The shared runner currently sends a completion haptic,
which needs a separate game SDK change if the app's accessibility setting must disable all haptics.
No cloud service or device connection is needed for the rules.
The standard game runner saves exactly one `ScoreRecord` per finished run through `ScoreRepository`.

The React Native app shell and game registry do not exist yet. The frontend owner can add the screen and registration
when the app is created, using this package without changing the game rules.
