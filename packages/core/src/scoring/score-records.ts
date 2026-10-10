import type { ScoreSnapshot } from './score-counter';
import type { ScoreRecord, Stars } from './types';

export class ScoreRecordError extends Error {
  override name = 'ScoreRecordError';
}

export function formatDeviceId(deviceId: number): string {
  return (deviceId >>> 0).toString(16).padStart(8, '0');
}

export interface AppScoreRecordInput {
  readonly gameId: string;
  readonly deviceId: string | null;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly snapshot: ScoreSnapshot;
  readonly stars: Stars;
  readonly completed: boolean;
  readonly newBest: boolean;
}

export function createAppScoreRecord(input: AppScoreRecordInput, random: () => number = Math.random): ScoreRecord {
  const suffix = Math.floor(random() * 0x100000000)
    .toString(16)
    .padStart(8, '0');
  const record: ScoreRecord = {
    id: `app-${input.gameId}-${input.startedAtMs}-${suffix}`,
    gameId: input.gameId,
    source: 'app',
    deviceId: input.deviceId,
    startedAt: new Date(input.startedAtMs).toISOString(),
    timeIsApproximate: false,
    durationMs: Math.round(input.durationMs),
    score: input.snapshot.score,
    stars: input.stars,
    completed: input.completed,
    newBest: input.newBest,
    actions: input.snapshot.actions,
    metrics: input.snapshot.metrics,
    fidgetRecordId: null,
  };
  validateScoreRecord(record);
  return record;
}

const GAME_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Throws ScoreRecordError unless `value` is a well-formed ScoreRecord. */
export function validateScoreRecord(value: unknown): asserts value is ScoreRecord {
  const fail = (why: string): never => {
    throw new ScoreRecordError(`invalid score record: ${why}`);
  };
  if (typeof value !== 'object' || value === null) return fail('not an object');
  const r = value as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0) fail('id');
  if (typeof r.gameId !== 'string' || !GAME_ID.test(r.gameId)) fail(`gameId "${String(r.gameId)}" is not kebab-case`);
  if (r.source !== 'app' && r.source !== 'fidget') fail('source');
  if (r.deviceId !== null && (typeof r.deviceId !== 'string' || !/^[0-9a-f]{8}$/.test(r.deviceId))) fail('deviceId');
  if (typeof r.startedAt !== 'string' || !ISO_UTC.test(r.startedAt)) fail('startedAt must be ISO 8601 UTC');
  if (typeof r.timeIsApproximate !== 'boolean') fail('timeIsApproximate');
  if (!isNonNegativeInteger(r.durationMs)) fail('durationMs');
  if (!isNonNegativeInteger(r.score)) fail('score');
  if (r.stars !== 0 && r.stars !== 1 && r.stars !== 2 && r.stars !== 3) fail('stars');
  if (typeof r.completed !== 'boolean') fail('completed');
  if (typeof r.newBest !== 'boolean') fail('newBest');
  if (!isNonNegativeInteger(r.actions)) fail('actions');
  if (typeof r.metrics !== 'object' || r.metrics === null) fail('metrics');
  for (const [name, metric] of Object.entries(r.metrics as object)) {
    if (typeof metric !== 'number' || !Number.isFinite(metric)) fail(`metric ${name}`);
  }
  if (r.fidgetRecordId !== null && !isNonNegativeInteger(r.fidgetRecordId)) fail('fidgetRecordId');
}
