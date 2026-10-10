import { createGeminiProvider, DEFAULT_MODEL } from './gemini';
import { createAIHttpServer } from './server';

const port = Number(process.env.JIMMY_AI_PORT ?? '8787');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('invalid JIMMY_AI_PORT');

const key = process.env.GEMINI_API_KEY;
const server = createAIHttpServer({
  providerForModel: (model, sessionKey) => createGeminiProvider({ apiKey: sessionKey ?? key, model }),
  allowedOrigin: process.env.JIMMY_AI_ALLOWED_ORIGIN ?? 'http://localhost:8081',
});
server.listen(port, '127.0.0.1', () => {
  // The key and request bodies are never logged.
  process.stdout.write(`Jimmy AI development proxy listening on 127.0.0.1:${port}; default model ${DEFAULT_MODEL}\n`);
});
