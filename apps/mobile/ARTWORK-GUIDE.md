# Swapping Jimmy's artwork

Yes: every illustration is separate from its screen's layout. Edit `src/artwork.ts`
to swap images. You do not need to rewrite the screen containers.

## Opening animation

The files are already copied from the images you supplied:

- `assets/intro-start.png` — your mint `JIMMY.png` (second image).
- `assets/intro-end.png` — your coral `Jimmying.png` (first image).

Replace those files, keeping the same names, to change the intro without editing
code. Both images are complete 1280 × 800 compositions, displayed without cropping.
If the replacement backgrounds have different colors, update `INTRO_BACKGROUNDS`
in `src/artwork.ts` to match. These colors fill the extra space on portrait phones.

The intro crossfades and gently zooms from the start image to the end image over
about two seconds. Timing lives in `src/screens/IntroScreen.tsx`. Reduced-motion
users see the final still briefly; the skip / Let's play button is always available.
It plays each time the app launches or its web preview is refreshed. Use
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
