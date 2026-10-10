# AI activity services

`src/local.ts` generates repeatable activity descriptions on device. A `variationSeed` changes
target layout and order; the same seed reproduces a level. `src/personalization.ts`
uses up to five recent, anonymous rounds and waits for three before moving difficulty one
step. `src/validation.ts` checks generated content against the request and accessibility
preferences. `src/service.ts` accepts an optional provider and uses the local generator
when that provider is disabled, unavailable, throws, or returns invalid data.

Import only the public `@jimmyit/ai` API. The package is platform-free and has no
network code. `apps/ai-service` owns the official Gemini SDK and server key.

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

A server response can use the same `GeneratedLevel` shape with `source: 'gemini'`.
For a Tap Quest request at difficulty 2 with theme `garden`, four targets, and default
accessibility preferences, an example valid response is:

```json
{
  "id": "garden-taps-2", "title": "Garden taps",
  "instructions": "Tap each circle in order.", "gameType": "tapQuest",
  "difficulty": 2,
  "targets": [
    { "x": 0.2, "y": 0.2, "radius": 0.094, "order": 0 },
    { "x": 0.8, "y": 0.2, "radius": 0.094, "order": 1 },
    { "x": 0.8, "y": 0.8, "radius": 0.094, "order": 2 },
    { "x": 0.2, "y": 0.8, "radius": 0.094, "order": 3 }
  ],
  "sequence": [], "theme": "garden",
  "timing": { "responseWindowMs": 3400, "activityDurationMs": 50000 },
  "sensory": { "motion": false, "sound": false, "distractions": false }, "source": "gemini"
}
```

It is accepted only after
`validateGeneratedLevel(response, request)` succeeds. An invalid response falls back
to local generation.

## Integration points

- Tap Quest varies playable patterns through `TapQuestOptions.patternSeed`. When Gemini
  generation is enabled, the app also validates generated targets and uses their
  positions for Precision, Memory, and Calm. If a layout is unsuitable at the game's
  adapted target size, play uses the local pattern. Trace uses local curved paths.
- The shape classifier supports circle, square, rectangle, and triangle; star is
  excluded. Shape Quest's author can map generated target shapes to its target list.
- Only controls in `availableInputControls` can appear in a memory sequence. The caller
  must report controls actually present on the current toy or screen.
- Settings lives in `apps/mobile/src/screens/SettingsScreen.tsx`. It stores non-secret
  provider and personalization choices locally, both off by default.
  `apps/mobile/src/ai-service.ts` exposes the configured service to the app.
- To try the feature in the web preview, open **Settings → Try an activity idea**.
  Choose Tap, Shape, Memory, Reaction, or Calm and press **Make sample level**.
  Each press supplies a new variation seed, including when Gemini is selected.
  The same section has two sample personalization buttons. These previews save no
  score. With Gemini selected and enabled, generation uses the configured proxy and
  falls back locally when it is unavailable.

## Local Gemini proxy

Run `npm run start -w @jimmyit/ai-service`. In the local web preview, open Settings,
paste a Gemini key into the editable field, and press **Save key for this session**.
The key goes to the loopback proxy, stays in its memory for at most 30 minutes, and
is never saved with mobile settings. **Remove key** revokes the session. Alternatively,
set `GEMINI_API_KEY` only in the server environment. The server listens on `127.0.0.1:8787` by
default. `JIMMY_AI_PORT` changes the port. For a web preview on another local origin,
set `JIMMY_AI_ALLOWED_ORIGIN` to that exact origin. Set
`EXPO_PUBLIC_JIMMY_AI_URL` in the mobile development environment to the proxy URL.
That variable is a URL, never a secret. Android emulators may need a host-loopback
alias; physical phones need an authenticated deployment before cloud generation is
available.

`GET /status?model=...` checks the selected model. `POST /generate` requires
`{ "optIn": true, "model": "...", "request": { ... } }`. The proxy accepts only
non-identifying generation fields and rejects performance history. It rate limits
requests, applies timeouts, asks Gemini for structured JSON, and validates the result.
The mobile service validates again and falls back locally on errors. Supported models
are `gemini-3.8-flash` (default) and `gemini-3.5-flash-lite`; the provider also checks
model availability through the SDK. Live Gemini tests are not part of CI.
`POST /session` accepts a key only from the exact allowed local web origin and
returns an in-memory token. The app sends that token in `X-Session-Token` for
subsequent calls. `DELETE /session` revokes it.

## Gemini security boundary

Only the local development proxy can call Gemini. The proxy binds to loopback and
has no public-client authentication; do not
expose it as an internet service without authentication and abuse controls. The app
never imports `@google/genai` or persists a key. It sends no names, diagnoses, raw
interaction history, drawings, or score records. The on-device validator is the final
gate. The paste-key flow is for the local web preview only; device storage alone
cannot make direct mobile Gemini calls safe.

The SDK usage and model choices were checked against the current
[Google Gen AI SDK reference](https://googleapis.github.io/js-genai/release_docs/index.html),
[structured output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output),
and [model list](https://ai.google.dev/gemini-api/docs/models).

`createAIService` never writes scores or rewards. The game runner remains responsible
for exactly one saved `ScoreRecord` per session.
