# Timed toy practice

**Skills:** every toy control. One-handed.

The child picks 30, 60 or 90 seconds and makes as many moves on the toy as they
like before time runs out.

- +5 points per move. Moves are counted by core's `createToyActionTracker`:
  a press, a 90° spin, a quarter turn of the screw (6 detents), a slider end,
  a rocker flip, or taking out the stylus.
- At least 10 points for any attempt (partial credit), even with no moves.
- Pausing stops the clock and ignores input. Finishing early keeps every point.
- Stars: 10 / 50 / 100.
- Metrics: one count per kind of move (`buttonPressCount`, `spinCount`,
  `screwTurnCount`, `slideCount`, `rockerToggleCount`, `stylusCount`). The
  first two keep the names from the first app version, so older records still
  count toward badges.

Use `createTimedPractice(durationMs)`. Every duration shares the game id
`timed-motor-practice`.
