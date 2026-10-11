# Button Hero

Button Hero practices timed presses, spinning and visual tracking. Notes travel
right to left along one track to a ring. Each note names a move on the toy in
words, with a symbol: **Click** (the clicker), **Left** and **Right** (the nav
keys) and **Spin** (the spinner). Spin notes are long purple bars, or riffs: keep
spinning while the bar passes through the ring. The track is slow on purpose:
every note is on screen for four to six and a half seconds, with two seconds or
more between notes, so a child can read the word and get ready. Notes glide
between game ticks, so they move smoothly. A three-second countdown comes
before the first note.

Easy, normal, and hard change the gaps, the timing windows and the riff length;
all three stay generous. A perfect press earns 100 points, a good one 50, and
every five in a row add a small bonus. A riff earns up to 150 points for the
share of it spent spinning (partial credit, so any spinning scores). A late
press or a missed note never takes points away; it only resets the combo. The
game saves perfect, good, miss, accuracy, and best combo metrics.

The rules take `{ type: 'button', move, pressed }` actions from the view and
keyboard (A, S, D, and hold F to spin), and read the real toy directly: clicker
and nav-key presses, and spinner movement, which keeps a riff going for 350 ms
after each spin event. Reduced-motion mode stops the glide; notes step with the
game tick.

## Windows demo

From the repository root, run `npm install` once and then
`npm run web -w @jimmyit/mobile`. Open the localhost URL printed by Expo,
finish or skip the intro, and choose **Button Hero** on the Play shelf. Pick a
difficulty and press Start. Use A, S, D and hold F, or the large move buttons. The game
works without connecting the virtual toy. The browser console identifies the
keyboard simulation input source. A run ends automatically and **Play again**
starts a fresh one. **Pause** and **Resume song** preserve game time while taking
a break.

## Hardware checklist

1. Check clicker, left and right presses register on the toy and over BLE.
2. Tune the spin hold time (350 ms) against the real spinner's event rate.
3. Measure input latency and calibrate the three timing windows.
4. Test approval, disconnect, and reconnect on a real phone and toy.
