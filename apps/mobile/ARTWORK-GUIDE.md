# Swapping Jimmy's artwork

Yes: every illustration is separate from its screen's layout. Edit `src/artwork.ts`
to swap images. You do not need to rewrite the screen containers.

## Opening animation

The intro is built from two pieces cut from your supplied `Jimmying.png` composition, so Jimmy can
move on his own:

- `assets/intro-face.png`: Jimmy's round face, transparent outside the circle.
- `assets/intro-wordmark.png`: the "JimmyIt" wordmark on a transparent background.

The screen starts mint (`INTRO_BACKGROUNDS.start`). A coral ring (`INTRO_BACKGROUNDS.end`) closes in from
beyond the screen's corners until its hole is exactly Jimmy's face. Then Jimmy hops, lands with a little
rebound, and rolls off to the right, pulling the coral screen away in rounded stripes to show Play.

Replace either file, keeping the same name, to change the art. `INTRO_LAYOUT` in `src/artwork.ts` says where
the face and wordmark sit in the original 1280 × 800 composition. Update it if your pieces are a different
size or in a different place. The composition is shown whole (contain sizing) on every screen shape.

Timing lives in `ANIMATIONS.introReveal` (`src/design/motion.ts`); the stripes' shapes are at the top of
`src/screens/IntroScreen.tsx`. Reduced-motion users see the coral picture briefly; the skip / Let's play
button is always available. It plays each time the app launches or its web preview is refreshed. Use
**Settings → Replay welcome** to preview changes again.

## Other image containers

Copy a local PNG or JPEG into `assets/`, then fill the corresponding slot:

```ts
bannerArt: { timed: null, tapQuest: null, drawing: require('../assets/my-drawing-picture.png'), shapes: null },
```

| Slot | Where it appears |
| --- | --- |
| `jimmyFace` | Small Jimmy faces: header, device status, and celebrations |
| `jimmyHero` | Large Jimmy illustration (not used by the current screens) |
| `bannerArt.timed` / `.tapQuest` / `.drawing` / `.shapes` | The picture on that game's play-screen banner |

Leave a slot as `null` to use the built-in vector artwork (banner drawings live in
`src/components/GameArt.tsx`; follow DESIGN.md's illustration rules for new ones). Transparent PNGs work
well for characters; activity pictures fit inside their rounded card containers.
The app uses contain sizing, preserving each image's aspect ratio on phones and tablets.
`jimmyFace` and `bannerArt` are square slots; `jimmyHero` is a portrait slot. Give activity art
some breathing room around its edges. Decorative images stay out of the screen
reader's way, while buttons keep their accessible names.

Device state always has a written label and icon. If you replace the face with
a static picture, Connected / Searching / Disconnected still remain understandable.

Reload the web preview after replacing an image. If Metro holds an old asset,
start it with `npm run web --workspace @jimmyit/mobile -- --clear`.

These are source-code image slots, rather than an in-app image-upload editor.
