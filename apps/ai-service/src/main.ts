import { createAIHttpServer } from './server';
import { createShapeInference } from './shape-inference';

const port = Number(process.env.JIMMY_AI_PORT ?? '8787');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('invalid JIMMY_AI_PORT');

const server = createAIHttpServer({
  allowedOrigin: (process.env.JIMMY_AI_ALLOWED_ORIGIN ?? 'http://localhost:8081,http://127.0.0.1:8081')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
  log: (message) => process.stdout.write(`${message}\n`),
  shapeInference: createShapeInference({ endpointUrl: process.env.HUGGING_FACE_ENDPOINT_URL,
    token: process.env.HUGGING_FACE_TOKEN }),
  shapeInferenceForToken: (token) => createShapeInference({
    endpointUrl: process.env.HUGGING_FACE_ENDPOINT_URL, token,
  }),
});
server.listen(port, '127.0.0.1', () => {
  // The key and request bodies are never logged.
  process.stdout.write(`Jimmy shape AI development proxy listening on 127.0.0.1:${port}\n`);
  process.stdout.write(`Hugging Face endpoint: ${
    process.env.HUGGING_FACE_ENDPOINT_URL ? 'set' : 'NOT SET (shape keys will be refused)'}\n`);
});
