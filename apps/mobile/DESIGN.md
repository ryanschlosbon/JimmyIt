# JimmyIt design rules

The rules every screen in `apps/mobile` follows. People and coding agents read
this before changing anything you can see. The source designs live in
[`/design`](../../design) at the repo root:

| File | What it decided |
| --- | --- |
| `Home_Play_Screen_Concept.png` | The play screen layout: header, a shelf of game banners, page dots |
| `Home_Play_Screen_No_Banner.png` | Header buttons, bubble background, banner size and peeking neighbors |
| `Timed_Run_Banner.png` | Banner look: pastel card, ink illustration with a colored ground shadow, berry High Score pill |
| `Example_Header.png` | The header, exactly |
| `Bubbles_Background.png` | The still bubble layout |
| `Draw_Page.png` | Inner screens: chunky rounded buttons in the brand colors |
| `Jimmy_Face.png` | The logo face (redrawn in SVG in `components/Jimmy.tsx`) |

## Who we design for

The players are children and teens with motor differences. That drives every rule:

1. **Big targets.** Anything tappable is at least **56 × 56** (`SIZE.touchTarget`). Leave at least 8 px between targets.
2. **One clear next step.** Each screen has one obvious main action (a big colored button). Everything else is quieter: white or outlined.
3. **Never punish.** No red "wrong", no "fail" or "lose", no shaking. A miss is just not a hit. (Product rules are in the root `AGENTS.md`.)
4. **Calm motion.** Movement is slow and soft, never flashing, and nothing moves without a reason. Every animation stops for reduced motion.
5. **Say it twice.** State is always shown with words plus a color or icon (for example "Jimmy connected" plus a mint dot), never color alone.
6. **Forgiving input.** Swipes need a clear sideways drag, and every swipe also has a button (arrows, dots).

## Where the design system lives

```text
src/design/palettes.ts   every color, grouped into color styles (Classic, Calm, …)
src/design/tokens.ts     fonts, spacing, radii, minimum sizes, type sizes
src/design/motion.ts     every animation by name, with an on/off switch
src/theme.ts             getTheme(dark, styleId): the palette screens draw with
src/components/Tappable.tsx   the one pressable surface (press, hover, focus)
```

Screens get colors only from `theme`, sizes only from `tokens`, and motion only
from `motion`. **No hex values in screens or components.** Some older screens
still have a few; replace them with a token when you touch that code.

## Color

### Using colors

Pick the **meaning**, not the hue:

| Token | Use |
| --- | --- |
| `page`, `surface`, `raised` | Window background; cards and panels; insets inside a card |
| `sheet` | Frosted panel under inner screens so text never sits on the bubbles |
| `header`, `headerBorder` | The top bar (slightly see-through, cream) |
| `text`, `secondary` | Headings and main copy; supporting copy |
| `ink` | Icons and labels **on colored buttons** (Play, chips, header buttons) |
| `accentText`, `gold` | Small accent text and line icons; stars and points |
| `focus` | Keyboard focus rings |
| `nav.play / rewards / settings` | The three header buttons |
| `bubbles`, `bubbleOpacity` | Background bubbles |
| `score.pill / pillText / value` | The High Score pill and number on banners |
| `dot`, `dotActive` | Page dots |
| `banners.<name>` | A game banner's pastel colors (below) |
| `coral`, `yellow`, `mint`, `teal`, `navy`, `berry`, `purple`, `pink`, `soft*` | Brand colors for decoration and older screens |

### Color styles (themes)

A **color style** is one complete look, with a light and a dark palette. The
child or a grown-up picks it in **Settings → Look & feel → Color style**; it is
saved on the device.

To add a style:

1. In `src/design/palettes.ts`, copy `classicLight` / `classicDark` (or spread
   them and override only what changes, as `calm` does).
2. Add it to `COLOR_STYLES` with a `label` and a one-line `description`.

That's all. The Settings chooser, saving and every screen pick it up
automatically. Keep these contrast rules in every style:

- `text` on `page`, `surface` and every banner `background`: **at least 7:1**.
- `ink` on every button color (`nav.*`, banner `accent`): **at least 4.5:1**.
- `secondary` on `surface`: at least 4.5:1.

### Banner colors

Each game banner picks a `BannerColorName` (`mint`, `lilac`, `peach`, `butter`,
`sky`, `rose`). Banners stay **pastel**:

- `background`: a very light tint (around 92–97 % lightness).
- `border`: the same hue, a step darker.
- `accent`: a mid tone that reads with `ink` on top. It fills the Play button and the chosen option.
- `shadow`: the ground ellipse under the illustration.

Neighboring games on the shelf should use different banner colors. To add a
color, add its name to `BannerColorName` and an entry to **every** palette.

## Type

| Role | Font | Token |
| --- | --- | --- |
| Wordmark, big numbers | Baloo 2 ExtraBold | `FONTS.displayHeavy` |
| Titles, headings, button words on banners | Baloo 2 Bold | `FONTS.display` |
| Sentences | Poppins Regular | `FONTS.body` |
| Small labels | Poppins Medium | `FONTS.bodyMedium` |
| Button and chip labels | Poppins SemiBold | `FONTS.bodyBold` |

- Main copy is never smaller than **16 px**; prefer 18–24. `TYPE.caption` (14) is for eyebrows only.
- Sentences are sentence case. Titles are Title Case ("Tap Quest", "High Score").
- Descriptions on banners are **one short line**. Longer help goes in the banner's "How to play" tip.
- Use plain words a seven-year-old knows. Encourage; never scold.

## Shape language

- **Everything is rounded.** `RADIUS.sm` 14 for chips, `md` 18 for buttons, `lg` 24 for cards, `xl` 32 for banners, `pill` for pills and the Play button. Circles for bubbles, dots, arrows and the info button.
- **Flat color.** No gradients. Borders are 1.5–2.5 px. Shadows only on things that float above other content (the "How to play" tip).
- **Chunky, friendly icons.** Line icons on a 24-unit grid (`components/Icon.tsx`), round caps and joins. On colored buttons, draw them in `ink` with a heavier `weight` (2.2 or more).
- **Illustrations** (`components/GameArt.tsx`): thick round-capped ink lines on a 100-unit grid, at most one accent fill, and a soft ground ellipse in the banner's `shadow` color.

## Buttons and press feedback

Every pressable thing is built on **`Tappable`** (or `Button`, which uses it). Never use a bare `Pressable`. That gives every press the same feel:

- **Press:** the button sinks 3 px, shrinks to 95 % and darkens slightly (`ANIMATION(pressDepress)`).
- **Hover** (mouse, web): a faint darkening.
- **Keyboard focus:** a 3 px `focus` ring outside the button, shown only after keyboard use.
- **Disabled:** 45 % opacity. Say why nearby when it isn't obvious.
- **Selected:** a filled accent color plus a check mark or marker. Never color alone.

Button kinds:

| Kind | Look | Use |
| --- | --- | --- |
| Main | Pill or rounded rect filled with an accent, `ink` label, icon on the left | The one thing to do next (Play) |
| Secondary | White `surface`, 1.5 px `border`, `text` label | Everything else |
| Chip | Small rounded rect; chosen = `accent` fill + `ink` border + check | Choosing one option |
| Icon | Square or circle, icon only, with an `accessibilityLabel` | Header, arrows, info, close |

## The header (`components/AppHeader.tsx`)

- **Left:** the Jimmy face and the **JimmyIt** wordmark. Tapping it goes to Play.
- **Right:** three square buttons, in this order: **Play** (`nav.play`, teal), **Rewards** (`nav.rewards`, coral, trophy) and **Settings** (`nav.settings`, yellow, gear). The current one has a small bar under it.
- **Status:** on wide screens, a "Jimmy connected / Find Jimmy" pill sits left of the buttons. On phones it becomes a colored dot on the Settings button.
- **Sizes:** 64 px buttons on tablets and 56 on phones. Below 350 px wide the wordmark hides and the face stays.
- **Background:** see-through cream (`header`), with a 2 px `headerBorder` underneath.

## The play screen (`screens/PlayScreen.tsx`)

This is the home screen. It holds a **shelf** of game banners, one per game:

```
┌ header ────────────────────────────────────────────────┐
│ (•‿•) JimmyIt               ● Jimmy connected [▶][🏆][⚙] │
└────────────────────────────────────────────────────────┘
  ┌──┐  ┌──────────────────────────────────────┐  ┌──┐
  │  │ ‹│ Timed Run                         (i)│› │  │   ← neighbors peek,
  │  │  │   ⏱               [ High Score ]     │  │  │     smaller and faded
  │  │  │  (art)                9140           │  │  │
  │  │  │                Every move scores!    │  │  │
  │  │  │             [0:30] [1:00] [1:30]     │  │  │
  │  │  │ ⓘ Plays with Jimmy   [ ▶  Play ]     │  │  │
  └──┘  └──────────────────────────────────────┘  └──┘
                       ● ▬ ● ●
```

- **Changing game:** swipe sideways, tap the ‹ › arrows, tap a dot, tap the peeking banner, or use the ← → keys. A drag counts once it moves 12 px sideways (more than it moves up or down). It changes game past 18 % of a banner's width, or after a quick flick.
- **Sizes:** on tablets in landscape the banner is 74 % of the width (at most 1040 px) at the concept's 1.62 : 1 proportion. On phones and portrait tablets it fills the width minus 28 px on each side, the content stacks, and the arrows move down beside the dots.
- **Banner neighbors** are 86 % size, washed with the page color, and not keyboard-focusable.
- **Dots:** one per game; the current one is a `dotActive` pill. Each dot has a white ring so it shows over bubbles.

### Game banners (`components/GameBanner.tsx`)

Every banner has the same anatomy, in this order of importance:

1. **Title** (Baloo, top left).
2. **Illustration** (`GameArt`, or a picture from `APP_ARTWORK.bannerArt`).
3. **Stat:** the berry **High Score** pill and number. A game where "best" means nothing shows a count instead (Drawing shows "Drawings").
4. **One-line description.** When an option is chosen and has a `caption`, the caption replaces it.
5. **Option chips** (only if the game has options): a time limit, a mode, and so on. One is always chosen. The chosen chip uses the banner's `accent`, a check and an ink border, and pops when chosen.
6. **Play** button, under the options, filled with the banner's `accent`.
7. **"What you play with"** at the bottom left: Plays with Jimmy, Uses the stylus, or Finger or stylus. For Jimmy games without a connected toy it changes to "Connect Jimmy to play".
8. **ⓘ How to play**, top right: a tip with the longer explanation.

Play goes straight into the game with the chosen option. When something is
missing, the game screen asks for it plainly ("Find Jimmy to start", "Take the
stylus out of Jimmy and the game will start") and starts as soon as it can.

### Adding a game to the shelf

1. Add an entry to `PLAY_SHELF` in `src/games.ts`. It needs: `id`, `title`,
   `tagline` (one line), `howTo` (two or three sentences), `art`, `color` (a
   banner color its neighbors don't use), `uses`, `options`, `stat` and
   `scoreGameId`.
2. Draw its illustration in `components/GameArt.tsx` (or set
   `APP_ARTWORK.bannerArt.<id>` to a picture).
3. Teach `play()` in `App.tsx` which screen to open.
4. Check the banner at 375 × 812, 768 × 1024 and 1280 × 800, in light and dark, and in each color style.

## Game screens fit the window

A game's playable area never needs scrolling: a drag on it must always play,
and a stylus that scrolls the page instead of drawing is the worst kind of
frustration. `App.tsx` gives every game screen a fixed stage between the header
and the bottom edge (no `ScrollView`), with **All games** and the score in one
row on top. Each game measures the space it gets (`onLayout`), not the window,
and gives the play area whatever is left:

- Drawing: tools in a sidebar when the stage is wide, in sideways-sliding strips
  under the canvas when it is tall (`art-layout.ts`).
- Tap Quest: the board is the biggest square that fits.
- Timed Run: the timer and the move counters sit side by side when wide.
- Button Hero and Knob Quest: the track or world takes the leftover height.

Game screens use the slim `ActivityHeader`. Short landscape windows also get
the compact app header. Rewards and Settings are reading screens and still
scroll. A new game screen follows the same rule; check it at the sizes in
"Before you open a PR" and make sure nothing scrolls.

## Background bubbles (`components/Bubbles.tsx`)

The big brand-colored circles behind every screen.

- **Floating** (the default): an endless stream of random bubbles. Each has a random size (14–32 % of the window's longer side), a random spot (mostly at the sides, so they frame the content), and walks through the style's `bubbles` colors so there is always a mix. Each rises slowly (14–28 px/s) with a gentle sway. When one leaves the top, a new random one starts below the bottom. (`ANIMATION(bubblesFloat)`.)
- **Still:** the layout from `Bubbles_Background.png`. Used when **Settings → Look & feel → Floating bubbles** is off, and always when the device asks for reduced motion.
- Bubbles never take touches and never sit on top of content. Inner screens put a frosted `sheet` between bubbles and text.

## Animations

Every animation is listed in `src/design/motion.ts` and marked in the code with
`ANIMATION(<name>)`. To find them all:

```sh
grep -rn "ANIMATION(" apps/mobile/src
```

- **To turn one off:** set its `enabled` to `false`.
- **To retune one:** change its numbers in `ANIMATIONS`.
- **To remove one for good:** delete its entry, then fix the places TypeScript flags (each is marked).

| Name | Where | What it does |
| --- | --- | --- |
| `pressDepress` | `Tappable` (every button) | Sink, shrink and darken while pressed |
| `shelfSlide` | `PlayScreen` | The shelf glides to the chosen game (340 ms ease-out) |
| `shelfNeighbors` | `PlayScreen` | Side banners shrink to 86 % and fade |
| `dotStretch` | `PageDots` | The current dot grows into a pill |
| `chipPop` | `GameBanner` | A chosen option chip pops |
| `tipReveal` | `GameBanner` | The "How to play" tip fades and grows in |
| `bubblesFloat` | `Bubbles` | Floating background bubbles |
| `screenEnter` | `PlayScreen` | Banners fade up when the play screen opens |
| `introReveal` | `IntroScreen` | A coral iris closes on Jimmy, he hops, then rolls off pulling the screen away in stripes |
| `scorePop` | `GameScoreBar` | At a score moment the score pops and a "500 points!" / "New best!" chip springs in |
| `scoreSparks` | `GameScoreBar` | A one-time burst of sparks off the score at a score moment |
| `toastSlide` | `CelebrationToast` | A strip slides down for score moments in the toy's own games |

Rules for new animations:

- **Register it.** Add it to `ANIMATIONS` with `enabled: true`, mark the code with `ANIMATION(name)`, and gate it with `useAnimation('name')`.
- **Respect reduced motion.** `useAnimation` returns false when the device asks for reduced motion (`pressDepress` is the only exception). Then jump straight to the end state.
- **Keep it short.** 120–350 ms for responses to a touch. Slow only for ambient motion such as the bubbles.
- **Animate transform and opacity** with `useNativeDriver: USE_NATIVE_DRIVER`. Layout properties (width, height) need `useNativeDriver: false` and should stay rare.
- **Never** flash, shake, or loop anything near the content the child is using.

## Accessibility checklist

- Every control has an `accessibilityLabel` that says what it does ("Play Timed Run, 60 seconds").
- Chips use `radio` / `radiogroup`; the header and dots use `tab` and report `selected`.
- Off-screen banners are hidden from screen readers and from keyboard focus.
- The keyboard can reach everything; ← → change game on the play screen.
- Status changes are announced (`accessibilityLiveRegion="polite"`).
- Nothing depends on color alone; contrast follows the palette rules above.

## Before you open a PR

Look at your change at **375 × 812** (phone), **768 × 1024** (tablet
portrait) and **1280 × 800** (tablet landscape). Check each of these:

- light and dark
- the **Calm** style
- bubbles off
- keyboard only

Then run `npm run check`.
