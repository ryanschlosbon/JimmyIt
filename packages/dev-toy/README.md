# @jimmyit/dev-toy (development only)

A virtual toy for building and testing the app with no hardware. It speaks the
real Bluetooth protocol bytes, so games, scoring, the toy's screen and
toy-to-app score sync behave exactly as they will with the real toy.

```tsx
import { createSimulatedToy, DevToyPanel } from '@jimmyit/dev-toy';

const simulator = createSimulatedToy();                // battery 84%, ~1 s "search"
const services = createJimmyServices({ storage, connector: simulator.connector });
// …render the app, then on top of it:
<DevToyPanel simulator={simulator} />
```

The **Toy** button opens a panel with:

- **Buttons (hold):** clicker and the left/right menu keys. Held while your finger is down.
- **Switches (tap to flip):** rocker, stylus in/out.
- **Slider:** hold either end.
- **Spinner and screw:** 45° steps or a full turn; loosen or tighten one detent.
- **Toy on its own:** "Toy plays Free Play" plays a whole game on the toy: live
  score moments go to the app if it's connected, then the game is stored. "Go
  out of range" drops the link. Battery down and charge.
- **Toy screen:** the "CONNECT TO …?" question (answer with Yes/No or the menu
  keys), celebrations ("NEW HIGH SCORE!", "+10"…), and what the app put on the OLED.
- **Haptics:** the last effects the app played.

Like the real toy, the virtual toy asks before a phone connects
(`createSimulatedToy({ approval: 'auto' })` skips that). It forgets approved
phones when the page reloads; the real toy keeps them in flash.

Typical checks:
- Find Jimmy in the app → answer yes on the virtual toy → connected.
- Go out of range → play a few games on the toy → back in range → Find Jimmy →
  the games appear in Rewards and the scoreboard.
- While connected, "Toy plays Free Play" → the app celebrates 100 points / a new best.

`apps/mobile` loads this package only in development builds and web previews
(`src/toy-connector.ts`), never in a release build for children.
