import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { validateGenerationRequest, validateGeneratedLevel, type AIProvider,
  type GameGenerationRequest } from '@jimmyit/ai';
import { DEFAULT_MODEL, SUPPORTED_MODELS } from './gemini';
import { parseShapeDrawing, validateShapeDrawing, SHAPE_MODEL_ID, type ShapeDrawing, type ModelLabel } from './shape-inference';

export interface AIServerOptions {
  readonly providerForModel: (model: string, apiKey?: string) => AIProvider;
  readonly allowedOrigin?: string;
  readonly nowMs?: () => number;
  readonly maxRequestsPerMinute?: number;
  readonly shapeInference?: {
    isAvailable(): boolean;
    predict(drawing: ShapeDrawing): Promise<{ readonly labels: readonly ModelLabel[]; readonly inferenceTimeMs: number }>;
  };
  readonly shapeInferenceForToken?: (token: string) => NonNullable<AIServerOptions['shapeInference']>;
}

const REQUEST_KEYS = new Set(['gameType', 'theme', 'difficulty', 'accessibilityPreferences',
  'targetCount', 'availableInputControls', 'variationSeed']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(request: IncomingMessage, maxLength = 12_000): Promise<unknown> {
  let body = '';
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > maxLength) throw new RangeError('request too large');
  }
  return JSON.parse(body) as unknown;
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

/** Local development proxy. Keep it bound to loopback until an authenticated deployment is designed. */
export function createAIHttpServer(options: AIServerOptions): Server {
  const nowMs = options.nowMs ?? Date.now;
  const limit = options.maxRequestsPerMinute ?? 12;
  let recentRequests: number[] = [];
  const sessions = new Map<string, { key: string; expiresAt: number }>();
  const shapeSessions = new Map<string, { key: string; expiresAt: number }>();
  const sessionLifetimeMs = 30 * 60_000;
  return createServer((request, response) => {
    void (async () => {
      if (request.headers.origin && request.headers.origin !== options.allowedOrigin) {
        return reply(response, 403, { error: 'Unavailable' });
      }
      if (options.allowedOrigin && request.headers.origin === options.allowedOrigin) {
        response.setHeader('Access-Control-Allow-Origin', options.allowedOrigin);
        response.setHeader('Vary', 'Origin');
      }
      if (request.method === 'OPTIONS') {
        if (request.headers.origin !== options.allowedOrigin) return reply(response, 403, { error: 'Unavailable' });
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token, X-Shape-Session');
        return reply(response, 200, {});
      }
      const url = new URL(request.url ?? '/', 'http://localhost');
      const model = url.searchParams.get('model') ?? DEFAULT_MODEL;
      for (const [token, session] of sessions) {
        if (session.expiresAt <= nowMs()) sessions.delete(token);
      }
      for (const [token, session] of shapeSessions) {
        if (session.expiresAt <= nowMs()) shapeSessions.delete(token);
      }
      if (url.pathname === '/shape/session') {
        if (request.method === 'POST') {
          if (!options.shapeInferenceForToken || shapeSessions.size >= 16) {
            return reply(response, 503, { error: 'Shape model unavailable' });
          }
          let payload: unknown;
          try { payload = await readJson(request); } catch { return reply(response, 400, { error: 'Invalid key' }); }
          if (!isObject(payload) || Object.keys(payload).length !== 1 ||
            typeof payload.apiKey !== 'string' || payload.apiKey.trim().length < 8 ||
            payload.apiKey.length > 512) return reply(response, 400, { error: 'Invalid key' });
          if (!options.shapeInferenceForToken(payload.apiKey.trim()).isAvailable()) {
            return reply(response, 503, { error: 'Shape model unavailable' });
          }
          const token = randomBytes(32).toString('base64url');
          shapeSessions.set(token, { key: payload.apiKey.trim(), expiresAt: nowMs() + sessionLifetimeMs });
          return reply(response, 200, { token, expiresInMs: sessionLifetimeMs });
        }
        if (request.method === 'DELETE') {
          const token = request.headers['x-shape-session'];
          if (typeof token === 'string') shapeSessions.delete(token);
          return reply(response, 200, { removed: true });
        }
      }
      if (url.pathname === '/session') {
        if (!options.allowedOrigin || request.headers.origin !== options.allowedOrigin) {
          return reply(response, 403, { error: 'Unavailable' });
        }
        if (request.method === 'POST') {
          if (sessions.size >= 16) return reply(response, 429, { error: 'Try again later' });
          let payload: unknown;
          try { payload = await readJson(request); } catch { return reply(response, 400, { error: 'Invalid request' }); }
          if (!isObject(payload) || typeof payload.apiKey !== 'string' ||
            payload.apiKey.trim().length < 8 || payload.apiKey.length > 512 || Object.keys(payload).length !== 1) {
            return reply(response, 400, { error: 'Invalid key' });
          }
          const token = randomBytes(32).toString('base64url');
          sessions.set(token, { key: payload.apiKey.trim(), expiresAt: nowMs() + sessionLifetimeMs });
          return reply(response, 200, { token, expiresInMs: sessionLifetimeMs });
        }
        if (request.method === 'DELETE') {
          const token = request.headers['x-session-token'];
          if (typeof token === 'string') sessions.delete(token);
          return reply(response, 200, { removed: true });
        }
      }
      const token = request.headers['x-session-token'];
      const key = typeof token === 'string' ? sessions.get(token)?.key : undefined;
      if (request.method === 'GET' && url.pathname === '/status') {
        if (!SUPPORTED_MODELS.includes(model as typeof SUPPORTED_MODELS[number])) {
          return reply(response, 400, { available: false, error: 'Unsupported model' });
        }
        return reply(response, 200, { available: await options.providerForModel(model, key).isAvailable(),
          model, supportedModels: SUPPORTED_MODELS });
      }
      const shapeSession = request.headers['x-shape-session'];
      if (url.pathname.startsWith('/shape/') && shapeSession !== undefined &&
        (typeof shapeSession !== 'string' || !shapeSessions.has(shapeSession))) {
        return reply(response, 401, { error: 'Shape session expired' });
      }
      const shapeKey = typeof shapeSession === 'string' ? shapeSessions.get(shapeSession)?.key : undefined;
      const shapeInference = shapeKey && options.shapeInferenceForToken
        ? options.shapeInferenceForToken(shapeKey) : options.shapeInference;
      if (url.pathname === '/shape/status' && request.method === 'GET') {
        return reply(response, 200, { available: shapeInference?.isAvailable() ?? false, modelId: SHAPE_MODEL_ID });
      }
      if (url.pathname === '/shape/predict' && request.method === 'POST') {
        recentRequests = recentRequests.filter((at) => at > nowMs() - 60_000);
        if (recentRequests.length >= limit) return reply(response, 429, { error: 'Try again later' });
        recentRequests.push(nowMs());
        let payload: unknown;
        try { payload = await readJson(request, 1_000_000); }
        catch { return reply(response, 400, { error: 'Invalid drawing' }); }
        if (!isObject(payload) || Object.keys(payload).length !== 1 || !('drawing' in payload)) {
          return reply(response, 400, { error: 'Invalid drawing' });
        }
        let drawing: ShapeDrawing;
        try {
          drawing = parseShapeDrawing(payload.drawing);
          validateShapeDrawing(drawing);
        }
        catch (error) {
          if (error instanceof RangeError && error.message.startsWith('drawing ')) {
            return reply(response, 422, { error: 'Drawing needs more detail' });
          }
          return reply(response, 400, { error: 'Invalid drawing' });
        }
        if (!shapeInference?.isAvailable()) return reply(response, 503, { error: 'Shape model unavailable' });
        try {
          const result = await shapeInference.predict(drawing);
          return reply(response, 200, { ...result, modelId: SHAPE_MODEL_ID });
        } catch (error) {
          if (error instanceof RangeError) return reply(response, 422, { error: 'Drawing needs more detail' });
          return reply(response, 503, { error: 'Shape model unavailable' });
        }
      }
      if (request.method !== 'POST' || url.pathname !== '/generate') {
        return reply(response, 404, { error: 'Not found' });
      }
      recentRequests = recentRequests.filter((at) => at > nowMs() - 60_000);
      if (recentRequests.length >= limit) return reply(response, 429, { error: 'Try again later' });
      recentRequests.push(nowMs());
      let payload: unknown;
      try { payload = await readJson(request); } catch { return reply(response, 400, { error: 'Invalid request' }); }
      if (!isObject(payload) || payload.optIn !== true || !isObject(payload.request) ||
        typeof payload.model !== 'string' ||
        !SUPPORTED_MODELS.includes(payload.model as typeof SUPPORTED_MODELS[number]) ||
        Object.keys(payload.request).some((key) => !REQUEST_KEYS.has(key))) {
        return reply(response, 400, { error: 'Invalid request' });
      }
      const generationRequest = payload.request as unknown as GameGenerationRequest;
      try { validateGenerationRequest(generationRequest); }
      catch { return reply(response, 400, { error: 'Invalid request' }); }
      const provider = options.providerForModel(payload.model, key);
      if (!await provider.isAvailable()) return reply(response, 503, { error: 'AI unavailable' });
      try {
        const level = validateGeneratedLevel(await provider.generate(generationRequest), generationRequest);
        return reply(response, 200, { level });
      } catch {
        return reply(response, 503, { error: 'AI unavailable' });
      }
    })().catch(() => {
      if (!response.headersSent) reply(response, 503, { error: 'AI unavailable' });
      else response.end();
    });
  });
}
