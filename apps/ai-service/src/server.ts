import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { parseShapeDrawing, validateShapeDrawing, SHAPE_MODEL_ID, type ShapeDrawing, type ModelLabel } from './shape-inference';

export interface AIServerOptions {
  /** Browser origins allowed to call the proxy; requests without an Origin (native apps, CLIs) are always allowed. */
  readonly allowedOrigin?: string | readonly string[];
  /** Development diagnostics; never receives keys, tokens, drawings or request bodies. */
  readonly log?: (message: string) => void;
  readonly nowMs?: () => number;
  readonly maxRequestsPerMinute?: number;
  readonly shapeInference?: {
    isAvailable(): boolean;
    predict(drawing: ShapeDrawing): Promise<{ readonly labels: readonly ModelLabel[]; readonly inferenceTimeMs: number }>;
  };
  readonly shapeInferenceForToken?: (token: string) => NonNullable<AIServerOptions['shapeInference']>;
}

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

/** Error names and validator reasons only; provider messages may echo secrets. */
function describeError(error: unknown): string {
  if (error instanceof RangeError) return error.message;
  if (error instanceof Error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? `${error.name} (HTTP ${status})` : error.name;
  }
  return 'unknown error';
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

/** Local development proxy. Keep it bound to loopback until an authenticated deployment is designed. */
export function createAIHttpServer(options: AIServerOptions): Server {
  const nowMs = options.nowMs ?? Date.now;
  const allowedOrigins: readonly string[] = typeof options.allowedOrigin === 'string'
    ? [options.allowedOrigin] : options.allowedOrigin ?? [];
  const log = options.log ?? (() => undefined);
  const limit = options.maxRequestsPerMinute ?? 12;
  let recentRequests: number[] = [];
  const shapeSessions = new Map<string, { key: string; expiresAt: number }>();
  const sessionLifetimeMs = 30 * 60_000;
  return createServer((request, response) => {
    void (async () => {
      // Browsers always send Origin on cross-origin calls, so foreign web pages stop here. Native apps send none.
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) {
        return reply(response, 403, { error: 'Unavailable' });
      }
      if (origin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
      }
      if (request.method === 'OPTIONS') {
        if (!origin) return reply(response, 403, { error: 'Unavailable' });
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shape-Session');
        return reply(response, 200, {});
      }
      const url = new URL(request.url ?? '/', 'http://localhost');
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
          log(`shape prediction failed: ${describeError(error)}`);
          return reply(response, 503, { error: 'Shape model unavailable' });
        }
      }
      return reply(response, 404, { error: 'Not found' });
    })().catch(() => {
      if (!response.headersSent) reply(response, 503, { error: 'Shape model unavailable' });
      else response.end();
    });
  });
}
