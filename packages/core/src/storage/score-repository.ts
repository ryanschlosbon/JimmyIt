import { validateScoreRecord } from '../scoring/score-records';
import type { ScoreRecord, ScoreSource } from '../scoring/types';
import { createEmitter, type Listener, type Unsubscribe } from '../util/emitter';
import type { KeyValueStore } from './key-value-store';

export const SCORE_STORAGE_KEY = 'jimmyit.scores';
export const SCORE_SCHEMA_VERSION = 1;

export class ScoreStorageError extends Error {
  override name = 'ScoreStorageError';
}

interface StoredScores {
  readonly schemaVersion: typeof SCORE_SCHEMA_VERSION;
  readonly records: readonly ScoreRecord[];
  /** deviceId → newest fidget recordId already saved. */
  readonly syncCursors: Readonly<Record<string, number>>;
}

export interface ScoreFilter {
  readonly gameId?: string;
  readonly source?: ScoreSource;
  readonly deviceId?: string;
  readonly limit?: number;
}

export interface GameSummary {
  readonly gameId: string;
  readonly sessions: number;
  readonly bestScore: number;
  readonly totalScore: number;
  readonly totalPlayMs: number;
  readonly lastPlayedAt: string;
}

export interface ScoreSummary {
  readonly sessions: number;
  readonly totalScore: number;
  readonly totalPlayMs: number;
  /** Most recently played first. */
  readonly games: readonly GameSummary[];
}

/** The one place scores are saved and read. All writes are serialized. */
export interface ScoreRepository {
  /** Returns false if a record with the same id was already saved. */
  save(record: ScoreRecord): Promise<boolean>;
  /** Returns how many records were new. */
  saveMany(records: readonly ScoreRecord[]): Promise<number>;
  /** Newest first. */
  list(filter?: ScoreFilter): Promise<readonly ScoreRecord[]>;
  /** Highest score for a game; the earlier session wins a tie. */
  best(gameId: string): Promise<ScoreRecord | null>;
  summary(): Promise<ScoreSummary>;
  getSyncCursor(deviceId: string): Promise<number>;
  setSyncCursor(deviceId: string, recordId: number): Promise<void>;
  /** Called after every successful write, e.g. to refresh a scores screen. */
  onChange(listener: Listener<void>): Unsubscribe;
  clearAll(): Promise<void>;
}

const EMPTY: StoredScores = { schemaVersion: SCORE_SCHEMA_VERSION, records: [], syncCursors: {} };

function byNewest(a: ScoreRecord, b: ScoreRecord): number {
  return a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0;
}

export function createScoreRepository(store: KeyValueStore, options: { maxRecords?: number } = {}): ScoreRepository {
  const maxRecords = options.maxRecords ?? 10_000;
  const changes = createEmitter<void>();
  let cache: StoredScores | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<StoredScores> {
    if (cache) return cache;
    const raw = await store.getItem(SCORE_STORAGE_KEY);
    if (raw === null) return (cache = EMPTY);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ScoreStorageError('stored scores are not valid JSON; refusing to overwrite them');
    }
    const data = parsed as Partial<StoredScores>;
    if (data.schemaVersion !== SCORE_SCHEMA_VERSION || !Array.isArray(data.records)) {
      // Never overwrite data written by a newer or unknown app version.
      throw new ScoreStorageError(`unsupported score schema version ${String(data.schemaVersion)}`);
    }
    return (cache = { schemaVersion: SCORE_SCHEMA_VERSION, records: data.records, syncCursors: data.syncCursors ?? {} });
  }

  async function write(next: StoredScores): Promise<void> {
    await store.setItem(SCORE_STORAGE_KEY, JSON.stringify(next));
    cache = next;
    changes.emit();
  }

  /** Runs `task` after every earlier read or write has finished. */
  function exclusive<T>(task: (data: StoredScores) => Promise<T> | T): Promise<T> {
    const run = queue.then(async () => task(await load()));
    queue = run.catch(() => undefined);
    return run;
  }

  function addRecords(data: StoredScores, records: readonly ScoreRecord[]): { next: StoredScores; added: number } {
    const known = new Set(data.records.map((r) => r.id));
    const fresh: ScoreRecord[] = [];
    for (const record of records) {
      validateScoreRecord(record);
      if (known.has(record.id)) continue;
      known.add(record.id);
      fresh.push(record);
    }
    let all = [...data.records, ...fresh];
    if (all.length > maxRecords) all = all.sort(byNewest).slice(0, maxRecords);
    return { next: { ...data, records: all }, added: fresh.length };
  }

  return {
    save: (record) =>
      exclusive(async (data) => {
        const { next, added } = addRecords(data, [record]);
        if (added > 0) await write(next);
        return added > 0;
      }),

    saveMany: (records) =>
      exclusive(async (data) => {
        const { next, added } = addRecords(data, records);
        if (added > 0) await write(next);
        return added;
      }),

    list: (filter = {}) =>
      exclusive((data) => {
        const matches = data.records
          .filter(
            (r) =>
              (filter.gameId === undefined || r.gameId === filter.gameId) &&
              (filter.source === undefined || r.source === filter.source) &&
              (filter.deviceId === undefined || r.deviceId === filter.deviceId),
          )
          .sort(byNewest);
        return filter.limit === undefined ? matches : matches.slice(0, filter.limit);
      }),

    best: (gameId) =>
      exclusive((data) => {
        let best: ScoreRecord | null = null;
        for (const r of data.records) {
          if (r.gameId !== gameId) continue;
          if (!best || r.score > best.score || (r.score === best.score && r.startedAt < best.startedAt)) best = r;
        }
        return best;
      }),

    summary: () =>
      exclusive((data) => {
        const games = new Map<string, GameSummary>();
        for (const r of data.records) {
          const g = games.get(r.gameId);
          games.set(r.gameId, {
            gameId: r.gameId,
            sessions: (g?.sessions ?? 0) + 1,
            bestScore: Math.max(g?.bestScore ?? 0, r.score),
            totalScore: (g?.totalScore ?? 0) + r.score,
            totalPlayMs: (g?.totalPlayMs ?? 0) + r.durationMs,
            lastPlayedAt: g && g.lastPlayedAt > r.startedAt ? g.lastPlayedAt : r.startedAt,
          });
        }
        const list = [...games.values()].sort((a, b) => (a.lastPlayedAt < b.lastPlayedAt ? 1 : -1));
        return {
          sessions: data.records.length,
          totalScore: list.reduce((sum, g) => sum + g.totalScore, 0),
          totalPlayMs: list.reduce((sum, g) => sum + g.totalPlayMs, 0),
          games: list,
        };
      }),

    getSyncCursor: (deviceId) => exclusive((data) => data.syncCursors[deviceId] ?? 0),

    setSyncCursor: (deviceId, recordId) =>
      exclusive(async (data) => {
        if (data.syncCursors[deviceId] === recordId) return;
        await write({ ...data, syncCursors: { ...data.syncCursors, [deviceId]: recordId } });
      }),

    onChange: (listener) => changes.subscribe(listener),

    clearAll: () =>
      exclusive(async () => {
        await store.removeItem(SCORE_STORAGE_KEY);
        cache = EMPTY;
        changes.emit();
      }),
  };
}
