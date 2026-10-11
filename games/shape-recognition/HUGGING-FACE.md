# Shape challenge: Hugging Face recognition

## Model and integration

The selected model is [`prithivMLmods/Geometric-Shapes-Classification`](https://huggingface.co/prithivMLmods/Geometric-Shapes-Classification),
an Apache-2.0 SigLIP2 image classifier with circle, triangle, square, and
rectangle among its eight labels. Its published 99.08% accuracy is on its own
dataset and **is not a JimmyIt accuracy measurement**. The 372 MB checkpoint is
not bundled with the Android app, and the model currently has no Hugging Face
Inference Provider. A dedicated Hugging Face Inference Endpoint running this
exact model is required for live AI predictions.

The existing canvas still records strokes in 1000 × 650 coordinates. With a
Hugging Face key entered in Settings, "All done" sends only those coordinates to the JimmyIt AI proxy. The proxy
validates their size, centers their bounds, preserves the drawing's proportions,
and rasterizes a black outline on a white 224 × 224 RGB PNG. The dedicated
endpoint's image-classification pipeline applies the model's own image
processor and returns actual labels and scores. The proxy returns those scores,
the model ID, and measured inference duration. The app maps the top label to
the four supported shapes and passes the result to the existing game runner.
The runner still owns points and the one `ScoreRecord` per game. Shape Quest
guides circle, triangle, square, and rectangle in that order; each match clears
the canvas for the next shape.

Without a Settings key, Shape Quest uses its existing local geometry classifier,
even when the proxy has a server-side key. `createShapeRecognizer()` also falls back to geometry when
the proxy is not configured or a model request fails. A fallback result says
`provider: 'geometry'`; it is never presented as model inference. In a
development build, the console logs the provider and model score without
logging the drawing. A match advances to the next shape; the same canvas allows
another try when the shape is unrecognized or different.

## Local setup

1. Create a **dedicated image-classification Inference Endpoint** for the
   exact model above in your Hugging Face account. Wait until it is ready.
2. Put the endpoint URL in the environment of the existing
   `@jimmyit/ai-service` process. In Jimmy settings, paste the Hugging Face
   token and select **Save shape key for this session**. The app sends it once
   to the trusted proxy and keeps only a temporary session ID in memory. The
   proxy holds the token in memory for up to 30 minutes. Alternatively, the
   server can have a token in its environment for direct proxy evaluations.
   Never use an `EXPO_PUBLIC_` variable for the token:

   ```powershell
   $env:HUGGING_FACE_ENDPOINT_URL = 'https://6acad49353d27c9b5cb0df5a.endpoints.huggingface.cloud'
   npm start -w @jimmyit/ai-service
   ```

3. Development builds and the web preview already point to
   `http://127.0.0.1:8787` through `apps/mobile/.env.development`; set
   `EXPO_PUBLIC_JIMMY_AI_URL` only to override it. For a USB-connected Android
   device or emulator, forward port 8787 with `adb reverse tcp:8787 tcp:8787`.
   The proxy prints at startup whether `HUGGING_FACE_ENDPOINT_URL` is set;
   without it, saving a shape key fails.

   ```powershell
   $env:EXPO_PUBLIC_JIMMY_AI_URL = 'http://127.0.0.1:8787'
   npm run android -w @jimmyit/mobile
   ```

   For the Windows browser demo, open a new PowerShell window at the repository
   root and run:

   ```powershell
   $env:EXPO_PUBLIC_JIMMY_AI_URL = 'http://127.0.0.1:8787'
   cd apps/mobile
   npx expo start --web --clear
   ```

   Open `http://localhost:8081`. Use `--clear` when changing the URL: an Expo
   export without clearing the old cache was observed to keep an empty proxy
   URL in its bundle. If 8081 is occupied, identify that process before
   starting another server; the local proxy currently allows this web origin.

4. Enter a key in Jimmy settings and select **Save shape key for this session**.
   The app sends the temporary session ID to `/shape/predict` automatically.
   Open Shape challenge, trace each guided shape, and tap "All done" after each.
   Inspect the development log for `provider: 'huggingface'`,
   the returned label, actual score, and measured inference time. Remove the
   shape key in Settings and play again to demonstrate the `geometry` fallback. A successful
   key save confirms that the proxy has an endpoint URL; a prediction confirms
   that the token works and the Hugging Face endpoint is serving requests.

5. To run the evaluator directly, set the endpoint URL and token in its
   PowerShell process, then run
   `npm run evaluate:shapes -w @jimmyit/ai-service`. To evaluate through an
   already-running proxy instead, that proxy must have its own server-side
   token configured; the app's temporary session is not used by this script:

   ```powershell
   $env:JIMMY_AI_PROXY_URL = 'http://127.0.0.1:8787'
   npm run evaluate:shapes -w @jimmyit/ai-service
   ```

   It submits clean,
   imperfect, and multiple-stroke drawings in the canvas's coordinate format,
   and prints each model prediction beside the geometry result. It reports
   only successful model requests in model accuracy and timing; unavailable
   requests are never counted as predictions. These are synthetic fixtures,
   so the results cannot stand in for a study of children's drawings.

For a USB-connected physical Android device, `adb reverse tcp:8787 tcp:8787`
keeps the proxy bound to loopback. Set `EXPO_PUBLIC_JIMMY_AI_URL` before starting
Expo; Expo embeds this public URL in the app bundle. Open Jimmy settings on the
phone, enter the token, save it for the session, then submit each guided shape in
Shape Quest and inspect the development log for `provider: 'huggingface'`. Remove the
key and play again to verify `provider: 'geometry'`. This exact phone sequence
has not yet run on a physical Android device. For another computer or a
phone without USB, use an authenticated HTTPS proxy URL. The current server has
no authentication on `/shape/predict` and must not be exposed through a public
tunnel or cloud deployment as-is. A plain same-Wi-Fi HTTP URL may be blocked by
Android's cleartext policy; production use should use HTTPS.

The proxy binds to loopback for local development. A remotely accessible proxy
needs authentication and HTTPS before use on children's devices. Neither the
proxy nor the app stores drawing images; the only remote payload is the
rendered drawing. No names, diagnoses, score history, or toy data are sent.
The user's approval for hosted recognition is the exception to this repo's
normal on-device data rule.

The proxy rejects blank, tiny, nearly straight, and clearly incomplete marks before model inference
with a 422 response. The game then uses its geometry result for encouraging
feedback. This check does not require a perfectly closed outline and permits
multi-stroke shapes. A model score measures the model's ranking of labels; it
is not a calibrated probability that a drawing is correct.

## Validation and limitations

Automated tests cover stroke validation, PNG generation, endpoint response
parsing, fallback, scoring, and repository persistence using a mock endpoint.
They prove the integration path but **do not measure the pretrained model**.
Performance on real child drawings, cold-start time, and Android behavior are
pending tests with representative drawings and a physical device. In particular,
published model performance may not transfer to
rough or multi-stroke outlines. Keep geometry fallback enabled until a labeled
evaluation covers clean, imperfect, multi-stroke, blank, wrong, and ambiguous
drawings. Do not claim an accuracy improvement without those measurements.

On 2026-10-10, before the validation check, a live proxy evaluation returned
the expected label for nine of ten synthetic marks. The model labeled a
straight line as a triangle with score 0.998. With validation added, an
expanded evaluation sent twelve valid synthetic drawings through the live
proxy: eleven received the expected label, and a tilted square was labeled
rhombus. Geometry also identified eleven of those twelve; it returned unknown
for the tilted square. The evaluator rejected all six invalid marks locally
before a model request. Average warm proxy request time was 569 ms and slowest
was 986 ms. A real mouse-drawn circle in the Expo web development build reached
`/shape/predict`; the model returned Circle with score 1.0 in 648 ms, the
development log named `provider: huggingface`, and the game awarded 30 points.
These results do not establish performance on children's drawings or on a cold
endpoint. The proxy retries temporary 502/503 cold-start responses for up to
60 seconds; the mobile shape adapter waits up to 70 seconds before falling back
to geometry. A real cold start has not been timed.

After the four-shape update, a browser playthrough with no Settings key
completed circle, triangle, square, and rectangle using local recognition. The
canvas cleared and guide changed after each match, and the game ended once with
115 points. The updated proxy's temporary session route, browser header
handling, revoke route, and 422 invalid-drawing response were exercised with a
dummy key. The user must enter a real token in Settings before the new session
flow can be verified against Hugging Face; no secret was copied into the test
process.
