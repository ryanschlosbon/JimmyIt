# Temporary Shape Recognition test UI

This self-contained browser preview uses the real Shape Recognition game,
`startGame`, and an in-memory `ScoreRepository`. It does not modify the mobile
app, connect to hardware, or send drawing data over a network. Scores reset
when the page is reloaded.

From the repository root, after `npm ci`, run:

```powershell
node .\node_modules\vite\bin\vite.js preview/shape-recognition --host 127.0.0.1
```

Open the local URL printed by Vite (usually `http://127.0.0.1:5173/`). Draw
with a mouse, finger, or stylus. Select a single shape or all four, submit
drawings, and watch the target, classification, points, and saved result. The
**Resend last drawing ID** control checks duplicate protection.

To remove this test UI, delete only the `preview/shape-recognition/` folder.
It adds no dependency or root configuration change.
