export type ScoreSource = 'app' | 'fidget';
export type Stars = 0 | 1 | 2 | 3;

/**
 * One finished play session, from an app game or a fidget basic mode. This is
 * the only shape that is stored, listed, summarized or sent anywhere.
 * Version changes go through SCORE_SCHEMA_VERSION in storage/score-repository.ts.
 */
export interface ScoreRecord {
  /** Unique and stable: re-saving the same session is a no-op. */
  readonly id: string;
  /** kebab-case game id, e.g. "squeeze-hold" or "fidget-spin-count". */
  readonly gameId: string;
  readonly source: ScoreSource;
  /** 8-hex-digit fidget id, or null if no fidget was connected. */
  readonly deviceId: string | null;
  /** ISO 8601 UTC. */
  readonly startedAt: string;
  /** True when the fidget had no clock and the start time is estimated. */
  readonly timeIsApproximate: boolean;
  readonly durationMs: number;
  /** Non-negative integer. Scores never go down during a game. */
  readonly score: number;
  readonly stars: Stars;
  /** False if the child quit early or the game was cancelled. */
  readonly completed: boolean;
  /** True if this beat every earlier score for the same gameId. */
  readonly newBest: boolean;
  /** How many interactions the child made: presses, turns, squeezes. */
  readonly actions: number;
  /** Game-specific numbers, camelCase keys, e.g. { longestHoldMs: 4200 }. */
  readonly metrics: Readonly<Record<string, number>>;
  /** The fidget's own record id for fidget sessions; null for app sessions. */
  readonly fidgetRecordId: number | null;
}
