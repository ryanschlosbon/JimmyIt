// End-to-end over the real wire format: core's FidgetClient and sync code
// against the simulated fidget.
import {
  connectFidgetClient,
  FidgetDeclinedError,
  type ScoreEvent,
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
    expect([...client.info.capabilities]).toEqual(['haptics', 'display', 'scoreLog', 'standaloneModes', 'scoreEvents', 'approval']);
    expect(fidget.clockUnixSeconds).toBe(START_MS / 1000);
  });

  it('turns toy input into events and state', async () => {
    const { fidget, client, events } = await setup();
    fidget.tap('clicker');
    fidget.press('sliderLow');
    fidget.spin(-90);
    fidget.turnScrew(3);
    expect(events).toEqual([
      { type: 'switchDown', switchId: 'clicker' },
      { type: 'switchUp', switchId: 'clicker', heldMs: 0 },
      { type: 'switchDown', switchId: 'sliderLow' },
      { type: 'spin', deltaDeg: -90, totalDeg: -90 },
      { type: 'screw', deltaDetents: 3, position: 3 },
    ]);
    expect(client.getState().switches.sliderLow).toBe(true);
    expect(client.getState().switches.stylusStowed).toBe(true);
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
    // A toy that answers everything except sync requests.
    const silent = {
      ...fidget.transport,
      write: async (characteristic: 'command', bytes: Uint8Array) => {
        if (bytes[0] !== 0x30) await fidget.transport.write(characteristic, bytes);
      },
    };
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

describe('the child says yes on the toy', () => {
  it('waits for the answer, then remembers the phone', async () => {
    const time = createManualTime(START_MS);
    const fidget = createFakeFidget({ clock: time.clock, approval: 'ask' });
    let pending = 0;
    const connecting = connectFidgetClient(fidget.transport, {
      clock: time.clock,
      scheduler: time.scheduler,
      appId: 42,
      appName: "Ryan's Pixel",
      onApprovalPending: () => pending++,
    });
    await vi.waitFor(() => expect(fidget.approvalRequest).toEqual({ appId: 42, name: "Ryan's Pixel" }));
    expect(pending).toBe(1);
    fidget.press('navRight'); // yes
    const client = await connecting;
    expect(fidget.approved).toBe(true);
    await client.disconnect();

    fidget.reconnect();
    const again = await connectFidgetClient(fidget.transport, { clock: time.clock, scheduler: time.scheduler, appId: 42 });
    expect(again.connected).toBe(true);
    expect(fidget.approvalRequest).toBeNull();
  });

  it('refuses the phone when the child says no, and sends it nothing before', async () => {
    const time = createManualTime(START_MS);
    const fidget = createFakeFidget({ clock: time.clock, approval: 'ask' });
    const inputs: Uint8Array[] = [];
    fidget.transport.subscribe('input', (bytes) => inputs.push(bytes));
    const connecting = connectFidgetClient(fidget.transport, { clock: time.clock, scheduler: time.scheduler, appId: 7 });
    await vi.waitFor(() => expect(fidget.approvalRequest).not.toBeNull());
    fidget.tap('clicker');
    expect(inputs).toHaveLength(0); // nothing reaches an unapproved phone
    fidget.press('navLeft'); // no
    await expect(connecting).rejects.toThrow(FidgetDeclinedError);
    expect(fidget.linked).toBe(false);
  });

  it('gives up when nobody answers', async () => {
    const time = createManualTime(START_MS);
    const fidget = createFakeFidget({ clock: time.clock, approval: 'ask' });
    const connecting = connectFidgetClient(fidget.transport, { clock: time.clock, scheduler: time.scheduler, approvalTimeoutMs: 30_000 });
    await vi.waitFor(() => expect(fidget.approvalRequest).not.toBeNull());
    time.advance(30_000);
    await expect(connecting).rejects.toThrow(FidgetTimeoutError);
  });
});

describe('score events', () => {
  it('lets the app make the toy celebrate', async () => {
    const { client, fidget } = await setup();
    await client.sendScoreEvent({ kind: 'newBest', score: 260, value: 250 });
    expect(fidget.lastCelebration).toMatchObject({ kind: 'newBest', score: 260, value: 250, source: 'app' });
  });

  it('streams moments from the toy\'s own game to the app as they happen', async () => {
    const { client, fidget } = await setup();
    fidget.finishStandaloneGame({ modeId: BasicModeId.freePlay, score: 30, durationS: 10 }); // earlier best: 30
    const events: ScoreEvent[] = [];
    client.onScoreEvent((event) => events.push(event));
    fidget.playStandaloneGame({ modeId: BasicModeId.freePlay, moves: 11, durationS: 40 });
    expect(events[0]).toEqual({ kind: 'gameStart', gameId: 'fidget-free-play', source: 'toy', score: 0, value: 30 });
    expect(events.filter((e) => e.kind === 'points')).toHaveLength(11);
    expect(events.filter((e) => e.kind !== 'points').map((e) => [e.kind, e.score, e.value])).toEqual([
      ['gameStart', 0, 30],
      ['newBest', 40, 30],
      ['milestone', 100, 100],
      ['gameEnd', 110, 30],
    ]);
  });
});
