import type { FidgetClient, FidgetRecord } from '../device/fidget-client';
import { BASIC_MODES, basicModeById, gameIdForBasicMode } from '../scoring/basic-modes';
import { starsFor } from '../scoring/scoring-helpers';
import type { ScoreRecord } from '../scoring/types';
import type { ScoreRepository } from '../storage/score-repository';
import type { Unsubscribe } from '../util/emitter';
import { type Clock, systemClock } from '../util/time';

const MAX_U32 = 0xffffffff;

/** Converts a fidget-scored game into the app's ScoreRecord. Stable id, so re-syncs dedupe. */
export function fidgetRecordToScoreRecord(record: FidgetRecord, deviceId: string, receivedAtMs: number): ScoreRecord {
  const mode = basicModeById(record.modeId);
  const startedAtMs = record.clockSet ? record.startUnix * 1000 : receivedAtMs - record.durationMs;
  return {
    id: `fidget-${deviceId}-${record.recordId}-${record.startUnix}`,
    gameId: gameIdForBasicMode(record.modeId),
    source: 'fidget',
    deviceId,
    startedAt: new Date(startedAtMs).toISOString(),
    timeIsApproximate: !record.clockSet,
    durationMs: record.durationMs,
    score: record.score,
    stars: mode ? starsFor(record.score, mode.starThresholds) : 0,
    completed: record.completed,
    newBest: record.newBest,
    actions: record.actions,
    metrics: {},
    fidgetRecordId: record.recordId,
  };
}

export interface SyncResult {
  readonly fetched: number;
  readonly added: number;
  readonly cursor: number;
}

/** Fidget → app: pulls every standalone game the app has not saved yet. */
export async function syncFidgetRecords(
  client: FidgetClient,
  repository: ScoreRepository,
  options: { clock?: Clock } = {},
): Promise<SyncResult> {
  const clock = options.clock ?? systemClock;
  const deviceId = client.info.deviceId;
  let cursor = await repository.getSyncCursor(deviceId);
  // The fidget's log restarted (reflash or wipe): its ids start again at 1.
  if (client.info.newestRecordId < cursor) cursor = 0;

  const fetched = await client.fetchRecords(cursor);
  const now = clock.now();
  const added = await repository.saveMany(fetched.map((r) => fidgetRecordToScoreRecord(r, deviceId, now)));
  const newest = fetched.reduce((max, r) => Math.max(max, r.recordId), cursor);
  await repository.setSyncCursor(deviceId, newest);
  if (fetched.length > 0) await client.ackRecords(newest);
  return { fetched: fetched.length, added, cursor: newest };
}

/** App → fidget: tells the fidget the best known score for each basic mode. */
export async function pushBestsToFidget(client: FidgetClient, repository: ScoreRepository): Promise<void> {
  for (const mode of BASIC_MODES) {
    const best = await repository.best(mode.gameId);
    if (best && best.score > 0) await client.setBest(mode.modeId, Math.min(best.score, MAX_U32));
  }
}

/** Saves standalone games that finish while the app is connected. */
export function saveLiveFidgetRecords(
  client: FidgetClient,
  repository: ScoreRepository,
  options: { clock?: Clock; onError?: (error: unknown) => void } = {},
): Unsubscribe {
  const clock = options.clock ?? systemClock;
  const onError = options.onError ?? (() => undefined);
  return client.onRecord((record) => {
    const deviceId = client.info.deviceId;
    void (async () => {
      await repository.save(fidgetRecordToScoreRecord(record, deviceId, clock.now()));
      // Only advance the cursor over a contiguous run; a gap is left for the next full sync.
      if ((await repository.getSyncCursor(deviceId)) === record.recordId - 1) {
        await repository.setSyncCursor(deviceId, record.recordId);
        await client.ackRecords(record.recordId);
      }
    })().catch(onError);
  });
}

/**
 * Everything to do right after connecting: pull stored fidget games, push
 * bests, then keep saving live ones. Returns a function that stops live saving.
 */
export async function startScoreSync(
  client: FidgetClient,
  repository: ScoreRepository,
  options: { clock?: Clock; onError?: (error: unknown) => void } = {},
): Promise<{ readonly initial: SyncResult; readonly stop: Unsubscribe }> {
  const stop = saveLiveFidgetRecords(client, repository, options);
  try {
    const initial = await syncFidgetRecords(client, repository, options);
    await pushBestsToFidget(client, repository);
    return { initial, stop };
  } catch (error) {
    stop();
    throw error;
  }
}
