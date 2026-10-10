import {
  BasicModeId,
  createManualTime,
  createMemoryKeyValueStore,
  type FidgetTransport,
  SCORE_STORAGE_KEY,
} from '@jimmyit/core';
import { createFakeFidget } from '@jimmyit/fake-fidget';
import { defineGame } from '@jimmyit/game-sdk';
import { describe, expect, it, vi } from 'vitest';
import { createGameCatalog } from './catalog';
import type { ToyConnector } from './connection';
import { getScoreboard } from './scoreboard';
import { createJimmyServices, ToyNotConnectedError } from './services';

const START_MS = new Date(2026, 9, 10, 15).getTime();

const tapGame = defineGame<{ taps: number }>({
  id: 'tap-test',
  title: 'Tap test',
  description: 'Each clicker press scores.',
  skills: ['press'],
  durationMs: 10_000,
  starThresholds: [1, 2, 3],
  create(session) {
    let taps = 0;
    return {
      getState: () => ({ taps }),
      onEvent(event) {
        if (event.type === 'switchDown' && event.switchId === 'clicker') {
          taps++;
          session.score.add(1);
        }
      },
    };
  },
});

const screenGame = defineGame({
  id: 'screen-test',
  title: 'Screen test',
  description: 'No toy needed.',
  skills: ['draw'],
  durationMs: 1_000,
  needsToy: false,
  starThresholds: [1, 2, 3],
  create: () => ({ getState: () => null }),
});

function setup() {
  const time = createManualTime(START_MS);
  const fake = createFakeFidget({ clock: time.clock, deviceId: 0x1234 });
  const connector: ToyConnector = {
    kind: 'simulated',
    async connect() {
      fake.reconnect();
      return fake.transport;
    },
  };
  const storage = createMemoryKeyValueStore();
  const services = createJimmyServices({ storage, connector, clock: time.clock, scheduler: time.scheduler });
  return { time, fake, storage, services };
}

describe('app services', () => {
  it('connects, syncs games played on the toy offline, and shows them on the scoreboard', async () => {
    const { fake, services } = setup();
    fake.dropConnection(); // the toy is away from the phone…
    fake.finishStandaloneGame({ modeId: BasicModeId.freePlay, score: 120, durationS: 45, actions: 12 });
    fake.finishStandaloneGame({ modeId: BasicModeId.freePlay, score: 80, durationS: 30, actions: 8 });

    await services.connection.connect(); // …then comes back
    expect(services.connection.getSnapshot()).toMatchObject({
      status: 'connected',
      connectorKind: 'simulated',
      info: { deviceId: '00001234' },
      lastSync: { fetched: 2, added: 2 },
    });

    const board = getScoreboard(await services.repository.list(), { games: createGameCatalog([tapGame]), nowMs: START_MS });
    expect(board.rows).toEqual([
      expect.objectContaining({ gameId: 'fidget-free-play', title: 'Free Play', playedOn: 'toy', sessions: 2, toySessions: 2, bestScore: 120 }),
    ]);
    expect(board).toMatchObject({ totalPoints: 200, toySessions: 2, today: { points: 200, sessions: 2 } });
  });

  it('runs a toy game against the connected toy and pushes the result back to it', async () => {
    const { fake, services, time } = setup();
    expect(() => services.play(tapGame)).toThrow(ToyNotConnectedError);
    await services.connection.connect();
    const run = services.play(tapGame);
    fake.tap('clicker');
    fake.tap('clicker');
    time.advance(10_000);
    const record = await run.result;
    expect(record).toMatchObject({ gameId: 'tap-test', score: 2, deviceId: '00001234' });
    expect(fake.display.score).toEqual({ score: 2, best: 2, stars: 2 });
  });

  it('plays screen-only games with no toy', async () => {
    const { services, time } = setup();
    expect(services.canPlay(screenGame)).toBe(true);
    const run = services.play(screenGame);
    time.advance(1_000);
    expect(await run.result).toMatchObject({ gameId: 'screen-test', deviceId: null });
  });

  it('notices when the toy goes out of range and can reconnect', async () => {
    const { fake, services } = setup();
    const statuses: string[] = [];
    services.connection.subscribe(() => statuses.push(services.connection.getSnapshot().status));
    await services.connection.connect();
    fake.dropConnection(new Error('out of range'));
    expect(services.connection.getSnapshot()).toMatchObject({ status: 'disconnected', error: { kind: 'lost' } });
    await services.connection.connect();
    expect(services.connection.getSnapshot()).toMatchObject({ status: 'connected', error: null });
    expect(statuses).toContain('searching');
  });

  it('cancels a slow search when the child taps cancel', async () => {
    const { fake } = setup();
    let release!: () => void;
    const slow: ToyConnector = {
      kind: 'simulated',
      connect: () =>
        new Promise<FidgetTransport>((resolve) => {
          release = () => resolve(fake.transport);
        }),
    };
    const storage = createMemoryKeyValueStore();
    const slowServices = createJimmyServices({ storage, connector: slow });
    const connecting = slowServices.connection.connect();
    await vi.waitFor(() => expect(slowServices.connection.getSnapshot().status).toBe('searching'));
    await slowServices.connection.disconnect();
    release();
    await connecting;
    expect(slowServices.connection.getSnapshot().status).toBe('disconnected');
    expect(slowServices.connection.getClient()).toBeNull();
  });

  it('reports builds with no toy connector instead of pretending', async () => {
    const services = createJimmyServices({ storage: createMemoryKeyValueStore(), connector: null });
    await services.connection.connect();
    expect(services.connection.getSnapshot()).toMatchObject({ status: 'disconnected', error: { kind: 'unavailable' } });
  });

  it('never overwrites saved scores it cannot read', async () => {
    const storage = createMemoryKeyValueStore({ [SCORE_STORAGE_KEY]: '{"schemaVersion":99,"records":[]}' });
    const services = createJimmyServices({ storage, connector: null });
    await expect(services.repository.list()).rejects.toThrow('unsupported score schema');
    expect(await storage.getItem(SCORE_STORAGE_KEY)).toBe('{"schemaVersion":99,"records":[]}');
  });
});

describe('connecting with the child’s yes', () => {
  it('shows "awaiting approval", then remembers the phone across app restarts', async () => {
    const time = createManualTime(START_MS);
    const fake = createFakeFidget({ clock: time.clock, approval: 'ask' });
    const connector: ToyConnector = {
      kind: 'simulated',
      async connect() {
        fake.reconnect();
        return fake.transport;
      },
    };
    const storage = createMemoryKeyValueStore();
    const services = createJimmyServices({ storage, connector, clock: time.clock, scheduler: time.scheduler, appName: 'Tablet' });
    const connecting = services.connection.connect();
    await vi.waitFor(() => expect(services.connection.getSnapshot().status).toBe('awaitingApproval'));
    expect(fake.approvalRequest?.name).toBe('Tablet');
    fake.answerApproval(true);
    await connecting;
    expect(services.connection.getSnapshot().status).toBe('connected');
    await services.connection.disconnect();

    // A new app session with the same storage keeps its id: the toy doesn't ask again.
    const restarted = createJimmyServices({ storage, connector, clock: time.clock, scheduler: time.scheduler });
    await restarted.connection.connect();
    expect(restarted.connection.getSnapshot().status).toBe('connected');
  });

  it('reports a "no" on the toy as declined', async () => {
    const time = createManualTime(START_MS);
    const fake = createFakeFidget({ clock: time.clock, approval: 'ask' });
    const services = createJimmyServices({
      storage: createMemoryKeyValueStore(),
      connector: { kind: 'simulated', connect: async () => fake.transport },
      clock: time.clock,
      scheduler: time.scheduler,
    });
    const connecting = services.connection.connect();
    await vi.waitFor(() => expect(fake.approvalRequest).not.toBeNull());
    fake.press('navLeft');
    await connecting;
    expect(services.connection.getSnapshot()).toMatchObject({ status: 'disconnected', error: { kind: 'declined' } });
  });
});

describe('one stream of score events', () => {
  it('carries app games and the toy’s own games', async () => {
    const { fake, services, time } = setup();
    const seen: string[] = [];
    services.onScoreEvent((event) => seen.push(`${event.source}:${event.kind}`));
    await services.connection.connect();

    fake.playStandaloneGame({ modeId: BasicModeId.freePlay, moves: 1, durationS: 5 });
    expect(seen).toEqual(['toy:gameStart', 'toy:points', 'toy:gameEnd']);

    seen.length = 0;
    const run = services.play(tapGame);
    await vi.waitFor(() => expect(seen).toContain('app:gameStart'));
    fake.tap('clicker');
    time.advance(10_000);
    await run.result;
    expect(seen).toEqual(['app:gameStart', 'app:points', 'app:gameEnd']);
  });
});
