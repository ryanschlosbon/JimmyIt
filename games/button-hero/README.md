# Button Hero

Button Hero practices timed button presses and visual tracking. Smiling-face
notes travel right to left along one horizontal track to a stationary target.
The art is drawn with React Native shapes inspired by the supplied face
references. Four buttons remain available in the computer demo; `laneCount`
accepts 1–8 so the final toy layout can be configured later. A/S/D/F map to
red/teal/yellow/purple faces. The touch buttons make it playable without a
keyboard. A three-second countdown precedes the first note.

Easy, normal, and hard use progressively shorter note spacing and timing
windows. Perfect earns 100 points, good earns 50, and every five consecutive
hits add a small bonus. An early or late press does not reduce points. Missed
notes reset the combo. The game saves perfect, good, miss, accuracy, and best
combo metrics through the existing game runner. The track has a visible target,
progress bar, score and combo display, brief judgment effects, and an end-of-song
summary. Reduced-motion mode shows notes at fixed positions that update in
steps, while judgment still uses the same timestamps.

The view sends `{ type: 'button', lane, pressed }` actions to the rules. A
future hardware adapter should translate approved toy button-down events to
these actions. The current firmware protocol does not promise four distinct
game buttons, so no physical mapping is claimed. The app keyboard adapter
should ignore repeated key-down events and use the game runner's elapsed time
for judgment.

## Windows demo

From the repository root, run `npm install` once and then
`npm run web -w @jimmyit/mobile`. Open the localhost URL printed by Expo,
finish or skip the intro, and choose **Button Hero** on the Play shelf. Pick a
difficulty and press Start. Use A/S/D/F or the large colored face buttons. The game
works without connecting the virtual toy. The browser console identifies the
keyboard simulation input source. A run ends automatically and **Play again**
starts a fresh one. **Pause** and **Resume song** preserve game time while taking
a break.

## Hardware checklist

1. Confirm the number and identities of actual buttons with the firmware team.
2. Map each approved button event to a zero-based lane and test press/release.
3. Measure input latency and calibrate the three timing windows.
4. Test approval, disconnect, and reconnect on a real phone and toy.
