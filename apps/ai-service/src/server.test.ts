import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { defaultAccessibilityPreferences, generateLocalLevel, type AIProvider,
  type GameGenerationRequest } from '@jimmyit/ai';
import { createAIHttpServer } from './server';

const request: GameGenerationRequest = { gameType: 'tapQuest', theme: 'garden', difficulty: 2,
  accessibilityPreferences: defaultAccessibilityPreferences(), availableInputControls: ['screenTouch'], targetCount: 3 };
const provider: AIProvider = { name: 'gemini', isAvailable: async () => true, testConnection: async () => true,
  generate: async () => ({ ...generateLocalLevel(request), source: 'gemini' }) };

const servers: ReturnType<typeof createAIHttpServer>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

async function start(limit = 12): Promise<string> {
  const server = createAIHttpServer({ providerForModel: () => provider, maxRequestsPerMinute: limit, nowMs: () => 100 });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function post(base: string, body: unknown): Promise<Response> {
  return fetch(`${base}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) });
}

describe('local AI proxy', () => {
  it('accepts a key only from the local preview and removes its session', async () => {
    const keys: (string | undefined)[] = [];
    const server = createAIHttpServer({ allowedOrigin: 'http://localhost:8081',
      providerForModel: (_model, key) => { keys.push(key); return provider; }, nowMs: () => 100 });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const body = JSON.stringify({ apiKey: 'test-secret-key' });
    expect((await fetch(`${base}/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).status).toBe(403);
    expect((await fetch(`${base}/session`, { method: 'POST', headers: { Origin: 'http://other.local',
      'Content-Type': 'application/json' }, body })).status).toBe(403);
    const saved = await fetch(`${base}/session`, { method: 'POST', headers: { Origin: 'http://localhost:8081',
      'Content-Type': 'application/json' }, body });
    expect(saved.status).toBe(200);
    const { token } = await saved.json() as { token: string };
    const status = await fetch(`${base}/status`, { headers: { Origin: 'http://localhost:8081',
      'X-Session-Token': token } });
    expect(status.status).toBe(200);
    expect(keys).toEqual(['test-secret-key']);
    expect((await fetch(`${base}/session`, { method: 'DELETE', headers: { Origin: 'http://localhost:8081',
      'X-Session-Token': token } })).status).toBe(200);
    await fetch(`${base}/status`, { headers: { 'X-Session-Token': token } });
    expect(keys).toEqual(['test-secret-key', undefined]);
  });
  it('requires opt-in and rejects raw performance history', async () => {
    const base = await start();
    expect((await post(base, { model: 'gemini-3.8-flash', request })).status).toBe(400);
    expect((await post(base, { optIn: true, model: 'gemini-3.8-flash',
      request: { ...request, performance: { recentRounds: [] } } })).status).toBe(400);
    expect((await post(base, { optIn: true, model: 'gemini-3.8-flash', request })).status).toBe(200);
  });

  it('reports model availability and limits requests', async () => {
    const base = await start(1);
    const status = await fetch(`${base}/status?model=gemini-3.8-flash`);
    expect(await status.json()).toMatchObject({ available: true, model: 'gemini-3.8-flash' });
    expect((await post(base, { optIn: true, model: 'gemini-3.8-flash', request })).status).toBe(200);
    expect((await post(base, { optIn: true, model: 'gemini-3.8-flash', request })).status).toBe(429);
    expect((await fetch(`${base}/status?model=unknown`)).status).toBe(400);
  });
});
