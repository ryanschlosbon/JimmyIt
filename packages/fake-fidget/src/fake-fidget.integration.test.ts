// End-to-end over the real wire format: core's FidgetClient and sync code
// against the simulated fidget.
import {
  connectFidgetClient,
  createManualTime,
  createMemoryKeyValueStore,
  createScoreRepository,
  type FidgetEvent,
  FidgetDisconnectedError,
  FidgetTimeoutError,
  ProtocolVersionMismatchError,
  startScoreSync,
  syncFidgetRecords,
} from '@jimmyit/core';
import { BasicModeId } from '@jimmyit/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createFakeFidget } from './fake-fidget';

const START_MS = Date.UTC(2026, 9, 10, 15);

async function setup() {
  const time = createManualTime(START_MS);
  const fidget = createFakeFidget({ clock: time.clock, deviceId: 0xabc123 });
  const client = await connectFidgetClient(fidget.transport, { clock: time.clock, scheduler: time.scheduler });
  const repository = createScoreRepository(createMemoryKeyValueStore());
  const events: Omit<FidgetEvent, 'at'>[] = [];
  client.onEvent(({ at: _at, ...event }) => events.push(event));
  return { time, fidget, client, repository, events };
}

describe('fidget client against the fake fidget', () => {
  it('connects, reads info and sets the clock', async () => {
    const { client, fidget } = await setup();
    expect(client.info).toMatchObject({ deviceId: '00abc123', protocolVersion: 1, firmwareVersion: '0.1.0' });
    expect([...client.info.capabilities]).toEqual(['haptics', 'display', 'scoreLog', 'standaloneModes']);
    expect(fidget.clockUnixSeconds).toBe(START_MS / 1000);
  });

  it('turns toy input into events and state', async () => {
    const { fidget, client, events } = await setup();
    fidget.tap('clicker');
    fidget.press('flapButtoned');
    fidget.spin(-90);
    fidget.turnScrew(3);
    expect(events).toEqual([
      { type: 'switchDown', switchId: 'clicker' },
      { type: 'switchUp', switchId: 'clicker', heldMs: 0 },
      { type: 'switchDown', switchId: 'flapButtoned' },
      { type: 'spin', deltaDeg: -90, totalDeg: -90 },
      { type: 'screw', deltaDetents: 3, position: 3 },
    ]);
    expect(client.getState().switches.flapButtoned).toBe(true);
    expect(client.getInputStats().lostPackets).toBe(0);
  });

  it('sends display, haptic and mode commands', async () => {
    const { fidget, client, events } = await setup();
    await client.showText(0, 'ignored in standalone');
    expect(fidget.display.lines[0]).toBe('');
    await client.setMode('app');
    await client.showText(1, 'Nice spinning!');
    await client.showScore({ score: 120, best: 150, stars: 2 });
    await client.feedback('success');
    expect(fidget.display.lines[1]).toBe('Nice spinning!');
    expect(fidget.display.score).toEqual({ score: 120, best: 150, stars: 2 });
    expect(fidget.haptics).toEqual([[10]]);
    expect(events).toContainEqual({ type: 'modeChange', mode: 'app' });
  });

  it('refuses a fidget on a different protocol version', async () => {
    const fidget = createFakeFidget({ protocolVersion: 2 });
    await expect(connectFidgetClient(fidget.transport)).rejects.toThrow(ProtocolVersionMismatchError);
  });

  it('rejects commands and pending fetches after the link drops', async () => {
    const { fidget, client } = await setup();
    const disconnects: (Error | null)[] = [];
    client.onDisconnect((error) => disconnects.push(error));
    fidget.dropConnection(new Error('out of range'));
    expect(client.connected).toBe(false);
    expect(fidget.mode).toBe('standalone');
    expect(disconnects.map((e) => e?.message)).toEqual(['out of range']);
    await expect(client.haptic(1)).rejects.toThrow(FidgetDisconnectedError);
  });

  it('times out a fetch the fidget never answers', async () => {
    const time = createManualTime(START_MS);
    const fidget = createFakeFidget({ clock: time.clock });
    const silent = { ...fidget.transport, write: async () => undefined };
    const client = await connectFidgetClient(silent, { clock: time.clock, scheduler: time.scheduler, syncClockOnConnect: false });
    const pending = client.fetchRecords(0);
    time.advance(5_000);
    await expect(pending).rejects.toThrow(FidgetTimeoutError);
  });
});

describe('score sync between fidget and app', () => {
  it('pulls standalone games played offline, once', async () => {
    const time = createManualTime(START_MS);
    const fidget = createFakeFidget({ clock: time.clock, deviceId: 0xabc123 });
    // Played on the toy before any phone connected (no clock yet).
    fidget.finishStandaloneGame({ modeId: BasicModeId.spinCount, score: 160, durationS: 30, actions: 16 });
    fidget.finishStandaloneGame({ modeId: BasicModeId.freePlay, score: 45, durationS: 90, completed: true });

    const client = await connectFidgetClient(fidget.transport, { clock: time.clock, scheduler: time.scheduler });
    const repository = createScoreRepository(createMemoryKeyValueStore());

    expect(await syncFidgetRecords(client, repository, { clock: time.clock })).toEqual({ fetched: 2, added: 2, cursor: 2 });
    expect(fidget.ackedRecordId).toBe(2);
    const spin = (await repository.list({ gameId: 'fidget-spin-count' }))[0];
    expect(spin).toMatchObject({
      id: 'fidget-00abc123-1-0',
      source: 'fidget',
      deviceId: '00abc123',
      score: 160,
      stars: 2,
      durationMs: 30_000,
      actions: 16,
      timeIsApproximate: true,
      fidgetRecordId: 1,
    });

    expect(await syncFidgetRecords(client, repository, { clock: time.clock })).toEqual({ fetched: 0, added: 0, cursor: 2 });
  });

  it('saves live games, pushes bests, and resyncs after a fidget log reset', async () => {
    const { fidget, client, repository, time } = await setup();
    const { initial, stop } = await startScoreSync(client, repository, { clock: time.clock });
    expect(initial.fetched).toBe(0);

    time.advance(60_000);
    fidget.finishStandaloneGame({ modeId: BasicModeId.spinCount, score: 200, durationS: 30 });
    await vi.waitFor(() => expect(fidget.ackedRecordId).toBe(1));
    const saved = await repository.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ timeIsApproximate: false, newBest: true, startedAt: '2026-10-10T15:00:30.000Z' });
    expect(await repository.getSyncCursor('00abc123')).toBe(1);
    expect(fidget.ackedRecordId).toBe(1);
    stop();

    // App → fidget: the best known score goes back to the toy.
    const repository2 = createScoreRepository(createMemoryKeyValueStore());
    await repository2.saveMany(saved);
    await repository2.setSyncCursor('00abc123', 50); // ahead of the fidget: its log was wiped
    const fresh = createFakeFidget({ clock: time.clock, deviceId: 0xabc123 });
    fresh.finishStandaloneGame({ modeId: BasicModeId.freePlay, score: 10, durationS: 20 });
    const client2 = await connectFidgetClient(fresh.transport, { clock: time.clock, scheduler: time.scheduler });
    const result = await startScoreSync(client2, repository2, { clock: time.clock });
    expect(result.initial).toEqual({ fetched: 1, added: 1, cursor: 1 });
    expect(fresh.bests.get(BasicModeId.spinCount)).toBe(200);
    result.stop();
  });
});
