import { defineGame, type GameSession } from '@jimmyit/game-sdk';

export type ButtonHeroDifficulty = 'easy' | 'normal' | 'hard';
export interface ButtonHeroNote { readonly lane: number; readonly atMs: number; }
export interface ButtonHeroAction { readonly type: 'button'; readonly lane: number; readonly pressed: boolean; }
export interface ButtonHeroState {
  readonly notes: readonly ButtonHeroNote[];
  readonly elapsedMs: number;
  readonly countdownMs: number;
  readonly laneCount: number;
  readonly resolved: readonly number[];
  readonly combo: number;
  readonly bestCombo: number;
  readonly perfect: number;
  readonly good: number;
  readonly misses: number;
  readonly accuracyPercent: number;
  readonly lastJudgment: 'perfect' | 'good' | 'miss' | 'tryAgain' | null;
  readonly lastJudgmentAtMs: number;
  readonly lastPoints: number;
  readonly score: number;
}
export interface ButtonHeroOptions {
  readonly difficulty?: ButtonHeroDifficulty;
  readonly laneCount?: number;
  readonly notes?: readonly ButtonHeroNote[];
}

const SETTINGS = {
  easy: { gapMs: 850, goodMs: 220, perfectMs: 110 },
  normal: { gapMs: 620, goodMs: 150, perfectMs: 75 },
  hard: { gapMs: 460, goodMs: 125, perfectMs: 65 },
} as const;
const COUNTDOWN_MS = 3_000;

export function createButtonHeroGame(options: ButtonHeroOptions = {}) {
  const laneCount = options.laneCount ?? 4;
  if (!Number.isInteger(laneCount) || laneCount < 1 || laneCount > 8) throw new Error('laneCount must be 1–8');
  const difficulty = options.difficulty ?? 'normal';
  const settings = SETTINGS[difficulty];
  const notes = options.notes ?? Array.from({ length: 18 }, (_, index) => ({
    lane: (index * 3 + Math.floor(index / laneCount)) % laneCount,
    atMs: COUNTDOWN_MS + 1_400 + index * settings.gapMs,
  }));
  if (notes.some((note, index) => !Number.isFinite(note.atMs) || note.atMs < COUNTDOWN_MS
    || !Number.isInteger(note.lane) || note.lane < 0 || note.lane >= laneCount
    || (index > 0 && note.atMs < (notes[index - 1]?.atMs ?? 0)))) {
    throw new Error('notes must be ordered and use available lanes');
  }
  const durationMs = (notes[notes.length - 1]?.atMs ?? COUNTDOWN_MS) + settings.goodMs + 800;
  return defineGame<ButtonHeroState, ButtonHeroAction>({
    id: `button-hero-${difficulty}`,
    title: 'Button Hero',
    description: 'Press each lane as its note reaches the line.',
    skills: ['press'],
    needsToy: false,
    durationMs,
    starThresholds: [50, 350, 900],
    create(session: GameSession) {
      const resolved = new Set<number>();
      let combo = 0;
      let bestCombo = 0;
      let perfect = 0;
      let good = 0;
      let misses = 0;
      let lastJudgment: ButtonHeroState['lastJudgment'] = null;
      let lastJudgmentAtMs = Number.NEGATIVE_INFINITY;
      let lastPoints = 0;
      let elapsedMs = 0;
      const missExpired = (nowMs: number) => {
        notes.forEach((note, index) => {
          if (!resolved.has(index) && nowMs > note.atMs + settings.goodMs) {
            resolved.add(index);
            misses++;
            combo = 0;
            lastJudgment = 'miss';
            lastJudgmentAtMs = nowMs;
            lastPoints = 0;
          }
        });
      };
      return {
        getState: () => ({ notes, elapsedMs, countdownMs: Math.max(0, COUNTDOWN_MS - elapsedMs), laneCount,
          resolved: [...resolved], combo, bestCombo, perfect, good, misses,
          accuracyPercent: resolved.size === 0 ? 100 : Math.round((perfect + good) * 100 / resolved.size),
          lastJudgment, lastJudgmentAtMs, lastPoints, score: session.score.score }),
        onTick(nowMs) { elapsedMs = nowMs; missExpired(nowMs); },
        onAction(action) {
          if (action.type !== 'button' || !action.pressed || action.lane < 0 || action.lane >= laneCount) return;
          const nowMs = session.elapsedMs();
          elapsedMs = nowMs;
          missExpired(nowMs);
          let selected = -1;
          let nearest = Number.POSITIVE_INFINITY;
          notes.forEach((note, index) => {
            const distance = Math.abs(nowMs - note.atMs);
            if (note.lane === action.lane && !resolved.has(index) && distance <= settings.goodMs && distance < nearest) {
              selected = index;
              nearest = distance;
            }
          });
          if (selected < 0) {
            lastJudgment = 'tryAgain';
            lastJudgmentAtMs = nowMs;
            lastPoints = 0;
            return;
          }
          resolved.add(selected);
          const isPerfect = nearest <= settings.perfectMs;
          if (isPerfect) perfect++;
          else good++;
          combo++;
          bestCombo = Math.max(bestCombo, combo);
          lastJudgment = isPerfect ? 'perfect' : 'good';
          lastJudgmentAtMs = nowMs;
          lastPoints = (isPerfect ? 100 : 50) + Math.min(50, Math.floor((combo - 1) / 5) * 10);
          session.score.add(lastPoints);
          session.score.countAction();
          session.feedback(isPerfect ? 'success' : 'tap');
        },
        onFinish() {
          missExpired(durationMs);
          session.score.setMetric('perfectCount', perfect);
          session.score.setMetric('goodCount', good);
          session.score.setMetric('missCount', misses);
          session.score.setMetric('bestComboCount', bestCombo);
          session.score.setMetric('accuracyPercent', notes.length === 0 ? 100 : Math.round((perfect + good) * 100 / notes.length));
        },
      };
    },
  });
}
