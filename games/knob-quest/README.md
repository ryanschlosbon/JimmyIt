# Knob Quest

Knob Quest practices coordinating two controls. One axis moves left or right;
the other supplies upward or downward lift while gravity and solid platforms
shape the route. Every run generates a new, repeatable route from a seed.
Faster upward turning gives more lift against gravity. Movement speed and
gravity stay the same at every difficulty. Easy has wider platforms and no
falling fireballs; Normal and Hard add a few timed fireballs, narrower
platforms, more ground traps, and longer routes. A midway checkpoint limits
the distance lost after a bump. Collecting a gem earns 30 points and reaching
the goal earns 100. Bumps never subtract points. Both controls can be held at
once. The on-screen arrows support touch play.

The rules accept `{ type: 'axis', axis, value }` with values from -1 to 1.
Keyboard arrows should send -1 or 1 while held, zero on release. The
`analogToAxis` adapter uses a configurable neutral (default 0.5), range
(default 0.5), and dead zone (default 0.12). `rotaryToAxis` converts relative
steps to a signed impulse using a configurable three-steps-for-full-speed
default; a future hardware bridge must decide when that impulse decays to
zero. `directionalToAxis` covers buttons or keyboard states. None assumes a
sensor type, pin, BLE characteristic, or packet format.

The game does not require the toy for simulation. It saves gem, checkpoint,
and completion time metrics through the existing game runner.

## Windows demo

From the repository root, run `npm install` once and then
`npm run web -w @jimmyit/mobile`. Open the localhost URL printed by Expo,
finish or skip the intro, and choose **Knob Quest** on the Play shelf. Pick a
difficulty and press Start. Hold left/right and up/down arrows independently,
or use the large touch arrows. The browser console identifies keyboard
simulation. No toy connection is required. Reach the purple goal to finish
and use **New route** to try a different level.

## Hardware checklist

1. Confirm which sensors provide the two axes and their direction signs.
2. Measure analog neutral, range, noise, and dead zone, or encoder step rate.
3. Translate approved BLE input into the normalized axis actions and release
   or decay values when rotation stops.
4. Test diagonal movement, device approval, disconnect, and reconnect on a
   real phone and toy.
