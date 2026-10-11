# AI activity services

`src/local.ts` generates repeatable activity descriptions on device. A `variationSeed` changes
target layout and order; the same seed reproduces a level. `src/personalization.ts`
uses up to five recent, anonymous rounds and waits for three before moving difficulty one
step. `src/validation.ts` checks generated content against the request and accessibility
preferences. `src/service.ts` wraps the local generator and avoids repeating any of the
last five layouts per game type.

Import only the public `@jimmyit/ai` API. The package is platform-free and has no
network code. Every level is generated on the device; there is no cloud level generator
(Gemini support was removed on 2026-10-11).

```ts
import { createAIService, defaultAccessibilityPreferences,
  getPersonalizationRecommendation } from '@jimmyit/ai';

const request = { gameType: 'tapQuest' as const, theme: 'garden', difficulty: 2 as const,
  accessibilityPreferences: defaultAccessibilityPreferences(),
  availableInputControls: ['screenTouch' as const], targetCount: 4 };
const level = await createAIService().generateLevel(request);
```

## Examples

Local request: `{ gameType: 'memoryQuest', theme: 'garden', difficulty: 2,
availableInputControls: ['clicker'], targetCount: 4 }` plus default accessibility
preferences produces this level. A single button is sufficient.

```json
{
  "id": "local-memoryquest-2-4", "title": "Memory Quest activity",
  "instructions": "Watch the pattern, then try it.", "gameType": "memoryQuest",
  "difficulty": 2, "targets": [],
  "sequence": ["clicker", "clicker", "clicker", "clicker"],
  "theme": "garden", "timing": { "responseWindowMs": 3400, "activityDurationMs": 50000 },
  "sensory": { "motion": false, "sound": false, "distractions": false }, "source": "local"
}
```

## Integration points

- Tap Quest varies playable patterns through `TapQuestOptions.patternSeed`. Trace uses
  local curved paths.
- The shape classifier supports circle, square, rectangle, and triangle; star is
  excluded. Shape Quest's author can map generated target shapes to its target list.
- Only controls in `availableInputControls` can appear in a memory sequence. The caller
  must report controls actually present on the current toy or screen.
- Settings lives in `apps/mobile/src/screens/SettingsScreen.tsx`. It stores the
  personalization choice locally, off by default.
  `apps/mobile/src/ai-service.ts` exposes the service to the app.
- To try the feature in the web preview, open **Settings → Try an activity idea**.
  Choose Tap, Shape, Memory, Reaction, or Calm and press **Make sample level**.
  Each press supplies a new variation seed. The same section has two sample
  personalization buttons. These previews save no score.

## Shape recognition proxy

`apps/ai-service` is now only the Hugging Face shape-recognition proxy; see
`games/shape-recognition/HUGGING-FACE.md`. `apps/mobile/.env.development` points
development builds and the web preview at it (`http://127.0.0.1:8787`). Web previews on
`localhost:8081` and `127.0.0.1:8081` are allowed; set `JIMMY_AI_ALLOWED_ORIGIN` to a
comma-separated list for other origins. A USB Android device reaches it after
`adb reverse tcp:8787 tcp:8787`.

`createAIService` never writes scores or rewards. The game runner remains responsible
for exactly one saved `ScoreRecord` per session.
