import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createAIHttpServer, type AIServerOptions } from './server';

const servers: ReturnType<typeof createAIHttpServer>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

const square = { width: 100, height: 100, strokes: [[
  { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }, { x: 10, y: 10 },
]] };
const fakeModel = (keys: string[] = []): NonNullable<AIServerOptions['shapeInferenceForToken']> => (key) => ({
  isAvailable: () => true, predict: async () => {
    keys.push(key);
    return { labels: [{ label: 'Square ◻', score: 0.9 }], inferenceTimeMs: 10 };
  },
});

async function start(options: AIServerOptions): Promise<string> {
  const server = createAIHttpServer({ nowMs: () => 100, ...options });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('local shape AI proxy', () => {
  it('serves model labels without accepting unrelated child data', async () => {
    let called = 0;
    const server = createAIHttpServer({
      shapeInference: { isAvailable: () => true, predict: async () => {
        called++;
        return { labels: [{ label: 'Circle ◯', score: 0.9 }], inferenceTimeMs: 15 };
      } }, nowMs: () => 100 });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const drawing = { width: 100, height: 100, strokes: [[
      { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }, { x: 10, y: 10 },
    ]] };
    expect(await (await fetch(`${base}/shape/status`)).json()).toMatchObject({ available: true });
    const predict = (body: unknown) => fetch(`${base}/shape/predict`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect((await predict({ drawing: { ...drawing, childName: 'Sam' } })).status).toBe(400);
    expect((await predict({ drawing: { ...drawing, strokes: [[
      { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
    ]] } })).status).toBe(422);
    const response = await predict({ drawing });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ modelId: 'prithivMLmods/Geometric-Shapes-Classification',
      labels: [{ label: 'Circle ◯', score: 0.9 }] });
    expect(called).toBe(1);
  });
  it('accepts a key from the native app, which sends no Origin', async () => {
    const keys: string[] = [];
    const base = await start({ allowedOrigin: 'http://localhost:8081', shapeInferenceForToken: fakeModel(keys) });
    const saved = await fetch(`${base}/shape/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'test-hf-key' }) });
    expect(saved.status).toBe(200);
    expect(saved.headers.get('access-control-allow-origin')).toBeNull();
    const { token } = await saved.json() as { token: string };
    expect((await fetch(`${base}/shape/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json',
      'X-Shape-Session': token }, body: JSON.stringify({ drawing: square }) })).status).toBe(200);
    expect(keys).toEqual(['test-hf-key']);
  });
  it('accepts any configured preview origin and refuses other web pages', async () => {
    const base = await start({ allowedOrigin: ['http://localhost:8081', 'http://127.0.0.1:8081'],
      shapeInferenceForToken: fakeModel() });
    const save = (origin: string) => fetch(`${base}/shape/session`, { method: 'POST', headers: { Origin: origin,
      'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'test-hf-key' }) });
    const saved = await save('http://127.0.0.1:8081');
    expect(saved.status).toBe(200);
    expect(saved.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:8081');
    expect((await save('http://other.local')).status).toBe(403);
  });
  it('no longer serves Gemini routes', async () => {
    const base = await start({});
    expect((await fetch(`${base}/status`)).status).toBe(404);
    expect((await fetch(`${base}/generate`, { method: 'POST', body: '{}' })).status).toBe(404);
    expect((await fetch(`${base}/session`, { method: 'POST', body: '{}' })).status).toBe(404);
  });
  it('uses a temporary Hugging Face session for shape inference and revokes it', async () => {
    const keys: string[] = [];
    const server = createAIHttpServer({ nowMs: () => 100,
      allowedOrigin: 'http://localhost:8081',
      shapeInferenceForToken: (key) => ({ isAvailable: () => true, predict: async () => {
        keys.push(key);
        return { labels: [{ label: 'Circle ◯', score: 0.92 }], inferenceTimeMs: 12 };
      } }),
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const preflight = await fetch(`${base}/shape/predict`, { method: 'OPTIONS', headers: {
      Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-shape-session',
    } });
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('access-control-allow-headers')).toContain('X-Shape-Session');
    const created = await fetch(`${base}/shape/session`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'test-hf-key' }) });
    expect(created.status).toBe(200);
    const { token } = await created.json() as { token: string };
    expect(await (await fetch(`${base}/shape/status`, { headers: { 'X-Shape-Session': token } })).json())
      .toMatchObject({ available: true });
    const drawing = { width: 100, height: 100, strokes: [[
      { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }, { x: 10, y: 10 },
    ]] };
    const predict = () => fetch(`${base}/shape/predict`, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Shape-Session': token,
    }, body: JSON.stringify({ drawing }) });
    expect((await predict()).status).toBe(200);
    expect(keys).toEqual(['test-hf-key']);
    expect((await fetch(`${base}/shape/session`, { method: 'DELETE',
      headers: { 'X-Shape-Session': token } })).status).toBe(200);
    expect((await predict()).status).toBe(401);
    expect(keys).toEqual(['test-hf-key']);
  });
  it('limits prediction requests', async () => {
    const base = await start({ maxRequestsPerMinute: 1, shapeInference: { isAvailable: () => true,
      predict: async () => ({ labels: [{ label: 'Square ◻', score: 0.9 }], inferenceTimeMs: 10 }) } });
    const predict = () => fetch(`${base}/shape/predict`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drawing: square }) });
    expect((await predict()).status).toBe(200);
    expect((await predict()).status).toBe(429);
  });
});
