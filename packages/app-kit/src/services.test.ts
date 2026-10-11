import {
  BasicModeId,
  createManualTime,
  createMemoryKeyValueStore,
  Feedback,
  type FidgetTransport,
  SCORE_STORAGE_KEY,
} from '@jimmyit/core';
import { createFakeFidget } from '@jimmyit/fake-fidget';
import { defineGame } from '@jimmyit/game-sdk';
import { describe, expect, it, vi } from 'vitest';
import { createGameCatalog } from './catalog';
import type { ToyConnector } from './connection';
import type { Reward } from './rewards';
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

  it('lets a game started before the toy connected (or reconnected) hear it', async () => {
    const { fake, services, time } = setup();
    const optionalToyGame = defineGame<{ taps: number }>({ ...tapGame, id: 'optional-toy', needsToy: false });
    const run = services.play(optionalToyGame);
    await services.connection.connect();
    fake.tap('clicker');
    expect(run.getState().taps).toBe(1);
    fake.dropConnection(new Error('out of range'));
    await services.connection.connect();
    fake.tap('clicker');
    expect(run.getState().taps).toBe(2);
    time.advance(10_000);
    expect(await run.result).toMatchObject({ score: 2, deviceId: '00001234' });
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

  it('forgets the toy, so the next connection asks the child again', async () => {
    const time = createManualTime(START_MS);
    const fake = createFakeFidget({ clock: time.clock, approval: 'ask' });
    const connector: ToyConnector = { kind: 'simulated', async connect() {
      fake.reconnect();
      return fake.transport;
    } };
    const storage = createMemoryKeyValueStore();
    const services = createJimmyServices({ storage, connector, clock: time.clock, scheduler: time.scheduler });
    const first = services.connection.connect();
    await vi.waitFor(() => expect(fake.approvalRequest).not.toBeNull());
    const firstId = fake.approvalRequest?.appId;
    fake.answerApproval(true);
    await first;

    await services.forgetToy();
    expect(services.connection.getSnapshot().status).toBe('disconnected');
    const again = services.connection.connect();
    await vi.waitFor(() => expect(services.connection.getSnapshot().status).toBe('awaitingApproval'));
    const secondId = fake.approvalRequest?.appId;
    expect(secondId).not.toBe(firstId);
    fake.answerApproval(true);
    await again;
    expect(services.connection.getSnapshot().status).toBe('connected');
    // Kept across restarts like any id.
    expect(await storage.getItem('jimmyit.appId')).toBe(String(secondId));
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

describe('rewards', () => {
  it('celebrates a new badge and a new level on the toy, and tells the screen', async () => {
    const { fake, services, time } = setup();
    const rewards: Reward[] = [];
    services.onReward((reward) => rewards.push(reward));
    await services.connection.connect();

    const run = services.play(tapGame);
    fake.tap('clicker');
    time.advance(10_000);
    await run.result; // the first game ever: the "First Click" badge
    await vi.waitFor(() => expect(rewards).toEqual([{ type: 'badge', badgeId: 'first' }]));
    expect(fake.haptics.at(-1)).toEqual(Feedback.badge);

    fake.playStandaloneGame({ modeId: BasicModeId.freePlay, moves: 25, durationS: 28 }); // 250 more points, live
    await vi.waitFor(() => expect(rewards.at(-1)).toEqual({ type: 'levelUp', level: 2 }));
    expect(fake.haptics.at(-1)).toEqual(Feedback.levelUp);
  });

  it('plays one haptic per sync, level-up first, and never replays records saved before startup', async () => {
    const { fake, storage, services, time } = setup();
    const first: Reward[] = [];
    services.onReward((reward) => first.push(reward));
    fake.dropConnection();
    fake.finishStandaloneGame({ modeId: BasicModeId.freePlay, score: 300, durationS: 60, actions: 30 });
    await services.connection.connect(); // the sync brings a level-up and the first badge at once
    await vi.waitFor(() => expect(first).toEqual([{ type: 'levelUp', level: 2 }, { type: 'badge', badgeId: 'first' }]));
    expect(fake.haptics).toEqual([Feedback.levelUp]);
    await services.connection.disconnect();

    const connector: ToyConnector = {
      kind: 'simulated',
      async connect() {
        fake.reconnect();
        return fake.transport;
      },
    };
    const restarted = createJimmyServices({ storage, connector, clock: time.clock, scheduler: time.scheduler });
    const later: Reward[] = [];
    restarted.onReward((reward) => later.push(reward));
    await restarted.connection.connect();
    const run = restarted.play(tapGame);
    fake.tap('clicker');
    time.advance(10_000);
    await run.result; // 301 points: still level 2, and "First Click" was earned before
    fake.playStandaloneGame({ modeId: BasicModeId.freePlay, moves: 20, durationS: 23 }); // 501: level 3
    await vi.waitFor(() => expect(later).toEqual([{ type: 'levelUp', level: 3 }]));
    expect(fake.haptics).toEqual([Feedback.levelUp, Feedback.levelUp]);
  });
});
