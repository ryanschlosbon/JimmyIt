# JimmyIt web playspace

This is a separate browser app for the same four activities as the mobile app:
Timed Run, Tap Quest (all four modes), Drawing, and Shape Challenge. It uses the
shared `@jimmyit/app-kit` and game packages for scoring, rewards, records, and
toy approval/sync. Web-only input, storage, visuals, and browser Bluetooth stay
in `apps/web`. The web build reads the mobile app's `PLAY_SHELF`, color styles,
and existing art so titles, options, colors, and illustrations stay aligned.
It does not change or bundle mobile screens.

## Run and verify

From the repository root, with Node 22.13 or newer:

```sh
npm install
npm run dev -w @jimmyit/web
npm run build -w @jimmyit/web
npm run check
```

The development server listens on `127.0.0.1:5173`. Keyboard and mouse input
works without a toy. To use the local Shape Challenge AI proxy, set
`HUGGING_FACE_ENDPOINT_URL` and `HUGGING_FACE_TOKEN` in the server process,
then start the separate service with `npm run start -w @jimmyit/ai-service`.
Credentials never enter the browser. If the model is unavailable, Shape
Challenge uses the game's local shape recognizer and says which one checked
the drawing. For production, configure an HTTPS
`VITE_JIMMY_AI_URL` proxy and its allowed web origin before building; without
one, the web app uses local recognition.

The Vite production output is `apps/web/dist`. Scores and preferences live in
this browser's local storage under `jimmyit.web.*`; they do not automatically
sync with the phone app. No analytics or third-party fonts are loaded.

## Deploy on Vercel

The separate Vercel project is named `jimmyit-web`. Its first deployment is
available at <https://jimmyit-web.vercel.app/>. The project was created from a
manual build; connect it to this repository after the web changes are pushed so
later changes deploy automatically. Keep its Root
Directory at the repository root so npm workspaces and shared packages are
available. Set the Framework Preset to **Other**, Build Command to
`npm run build -w @jimmyit/web`, and Output Directory to `apps/web/dist`.
Enable the project's option to skip deployments when only unrelated workspaces
change. This gives the website its own deployments and domain, independent of
the mobile app.

`jimmyingit.us` is the primary domain, with `www.jimmyingit.us` redirecting
to it. Porkbun manages DNS. Deployments of this separate project do not alter
the phone app.

Web Bluetooth requires HTTPS and a browser that supports the API. The chooser
opens only after the player presses Connect, and the child must approve the
connection on Jimmy. Use Keyboard & Mouse in browsers without Web Bluetooth.
The real toy connection still needs testing against firmware on hardware.

## Boundaries

- Changes to web controls belong in `apps/web/src/web-input.ts` and the web UI.
- Changes to browser Bluetooth belong in `apps/web/src/web-bluetooth.ts`.
- Browser scores and preferences use their own namespace in `web-storage.ts`.
- Shared game rules remain in `games/*` and `packages/*`; mobile imports none of
  the web files.
