import { nextMilestoneAfter, ScoreEventKind, type ScoreEventKindName } from '@jimmyit/protocol';

/**
 * A moment worth celebrating in a game (PROTOCOL.md "Score events"). The same
 * rules run in the firmware (score_events.cpp), so a toy game and an app game
 * celebrate the same moments.
 */
export interface ScoreEvent {
  readonly kind: ScoreEventKindName;
  readonly gameId: string;
  /** Who is running the game: an app game, or one the toy plays by itself. */
  readonly source: 'app' | 'toy';
  /** The game's total score after this moment. */
  readonly score: number;
  /**
   * gameStart / gameEnd: the best score before this game (0 = none).
   * points: points just added. milestone: the milestone reached (100, 500,
   * 1000, 1500, 2000, 3000, then every 1000; see nextMilestoneAfter).
   * newBest: the best that was just beaten.
   */
  readonly value: number;
}

export type ScoreEventDraft = Omit<ScoreEvent, 'gameId' | 'source'>;

export interface ScoreEventTracker {
  start(): ScoreEventDraft;
  /** Feed the running total; returns the moments it caused, in order. */
  onScore(score: number): readonly ScoreEventDraft[];
  end(): ScoreEventDraft;
  readonly beatBest: boolean;
}

export function createScoreEventTracker(previousBest: number): ScoreEventTracker {
  let lastScore = 0;
  let beatBest = false;
  return {
    start: () => ({ kind: 'gameStart', score: 0, value: previousBest }),
    onScore(score) {
      if (score <= lastScore) return [];
      const events: ScoreEventDraft[] = [{ kind: 'points', score, value: score - lastScore }];
      for (let m = nextMilestoneAfter(lastScore); m <= score; m = nextMilestoneAfter(m)) {
        events.push({ kind: 'milestone', score, value: m });
      }
      if (previousBest > 0 && !beatBest && score > previousBest) {
        beatBest = true;
        events.push({ kind: 'newBest', score, value: previousBest });
      }
      lastScore = score;
      return events;
    },
    end: () => ({ kind: 'gameEnd', score: lastScore, value: previousBest }),
    get beatBest() {
      return beatBest;
    },
  };
}

export function scoreEventKindFromWire(kind: number): ScoreEventKindName | null {
  const entry = Object.entries(ScoreEventKind).find(([, value]) => value === kind);
  return entry ? (entry[0] as ScoreEventKindName) : null;
}

/** True for gameEnd when the game beat every earlier score (including a first game). */
export function isNewBestAtEnd(event: Pick<ScoreEvent, 'kind' | 'score' | 'value'>): boolean {
  return event.kind === 'gameEnd' && event.score > event.value;
}
