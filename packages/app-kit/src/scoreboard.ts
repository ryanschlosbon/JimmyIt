import type { ScoreRecord, Stars } from '@jimmyit/core';
import type { CatalogEntry } from './catalog';

export interface ScoreboardRow {
  readonly gameId: string;
  readonly title: string;
  readonly playedOn: 'app' | 'toy';
  readonly sessions: number;
  /** Of those, how many were played on the toy without the app. */
  readonly toySessions: number;
  readonly bestScore: number;
  readonly bestStars: Stars;
  readonly totalScore: number;
  readonly lastScore: number;
  readonly lastPlayedAt: string;
}

export interface Scoreboard {
  readonly totalPoints: number;
  readonly sessions: number;
  readonly playTimeMs: number;
  readonly toySessions: number;
  readonly today: { readonly points: number; readonly sessions: number };
  /** One row per game played, most recently played first. */
  readonly rows: readonly ScoreboardRow[];
  /** Latest sessions, newest first. */
  readonly recent: readonly ScoreRecord[];
}

function titleFor(gameId: string, games: readonly CatalogEntry[]): string {
  const known = games.find((game) => game.id === gameId);
  if (known) return known.title;
  const words = gameId.replace(/^fidget-/, '').split('-');
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function isSameLocalDay(iso: string, nowMs: number): boolean {
  const a = new Date(iso);
  const b = new Date(nowMs);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Per-game bests and totals for scoreboard screens, from app and toy sessions alike. */
export function getScoreboard(
  records: readonly ScoreRecord[],
  options: { games?: readonly CatalogEntry[]; nowMs?: number; recentLimit?: number } = {},
): Scoreboard {
  const games = options.games ?? [];
  const nowMs = options.nowMs ?? Date.now();
  const newestFirst = [...records].sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));

  const rows = new Map<string, ScoreboardRow>();
  for (const record of newestFirst) {
    const row = rows.get(record.gameId);
    const keepBest = row !== undefined && record.score < row.bestScore; // a tie goes to the earlier session
    rows.set(record.gameId, {
      gameId: record.gameId,
      title: row?.title ?? titleFor(record.gameId, games),
      playedOn: row?.playedOn ?? (record.source === 'fidget' ? 'toy' : 'app'),
      sessions: (row?.sessions ?? 0) + 1,
      toySessions: (row?.toySessions ?? 0) + (record.source === 'fidget' ? 1 : 0),
      bestScore: keepBest ? row.bestScore : record.score,
      bestStars: keepBest ? row.bestStars : record.stars,
      totalScore: (row?.totalScore ?? 0) + record.score,
      // Rows are built newest first, so the first record seen is the latest.
      lastScore: row?.lastScore ?? record.score,
      lastPlayedAt: row?.lastPlayedAt ?? record.startedAt,
    });
  }

  const today = newestFirst.filter((record) => isSameLocalDay(record.startedAt, nowMs));
  return {
    totalPoints: records.reduce((sum, record) => sum + record.score, 0),
    sessions: records.length,
    playTimeMs: records.reduce((sum, record) => sum + record.durationMs, 0),
    toySessions: records.filter((record) => record.source === 'fidget').length,
    today: { points: today.reduce((sum, record) => sum + record.score, 0), sessions: today.length },
    rows: [...rows.values()],
    recent: newestFirst.slice(0, options.recentLimit ?? 10),
  };
}
