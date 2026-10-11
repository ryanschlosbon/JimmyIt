# Knob Quest

Knob Quest practices coordinating two controls. The player is Jimmy, who rolls
as he moves, stretches when he flies, squashes when he lands and throws sparks
when he takes off. One control rolls him left or right; the other lifts him
against gravity. On the toy, the spinner rolls and the screw lifts, and turning
faster pushes harder. Every run generates a new, repeatable route from a seed.

Easy has a solid floor. Normal cuts small holes in the floor under some
platforms; hard cuts big ones plus a stretch with no floor at all, where the
platforms are the way across. Normal and hard also drop a few timed fireballs.
Movement and gravity are the same at every difficulty.

Jimmy has three lives, shown by his color: green, then yellow, then red.
Falling into a hole or bumping a fireball costs a life, and he comes back at the
midway checkpoint once it is reached. After the last life the run ends gently
("Jimmy needs a little rest!") and keeps every point. Landing on a platform for
the first time earns 20 points, the checkpoint 50 and the flag 100. Points never
go down. Both controls can be held at once. The on-screen arrows support touch
play.

The rules accept `{ type: 'axis', axis, value }` with values from -1 to 1 from
the view and keyboard, and read the toy's `spin` and `screw` events directly as
"turning energy" that fades over 250 ms: about 480 degrees a second of spinning,
or 8 screw detents a second, is full speed. `analogToAxis`, `rotaryToAxis` and
`directionalToAxis` remain for other sources. The app draws Jimmy and passes him
to the view as `renderPlayer`; without it the view draws a plain face.

The game does not require the toy. It saves platform, restart, lives-left and
completion time metrics through the game runner.

## Windows demo

From the repository root, run `npm install` once and then
`npm run web -w @jimmyit/mobile`. Open the localhost URL printed by Expo,
finish or skip the intro, and choose **Knob Quest** on the Play shelf. Pick a
difficulty and press Start. Hold left/right and up/down arrows independently,
or use the large touch arrows. The browser console identifies keyboard
simulation. No toy connection is required. Reach the purple flag to finish
and use **New route** to try a different level.

## Hardware checklist

1. Confirm the spinner and screw direction signs feel right (clockwise = right,
   tighten = up).
2. Tune the full-speed rates and the 250 ms fade against real spinning.
4. Test diagonal movement, device approval, disconnect, and reconnect on a
   real phone and toy.
