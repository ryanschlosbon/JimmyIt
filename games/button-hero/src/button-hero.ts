import { defineGame, type FidgetEvent, type GameSession } from '@jimmyit/game-sdk';

export type ButtonHeroDifficulty = 'easy' | 'normal' | 'hard';
/** The toy moves a note can ask for: the clicker, the two nav keys, a slider strum, and spinning. */
export const BUTTON_HERO_MOVES = ['click', 'left', 'right', 'strum', 'spin'] as const;
export type ButtonHeroMove = (typeof BUTTON_HERO_MOVES)[number];
/** `holdMs` > 0 makes a spin riff: keep spinning for that long. Other moves are single presses. */
export interface ButtonHeroNote { readonly move: ButtonHeroMove; readonly atMs: number; readonly holdMs: number; }
/** pressed: false ends a held spin (keyboard F or the touch Spin button let go). */
export interface ButtonHeroAction { readonly type: 'button'; readonly move: ButtonHeroMove; readonly pressed: boolean; }
export type ButtonHeroJudgment = 'perfect' | 'good' | 'miss' | 'tryAgain';
export interface ButtonHeroState {
  readonly notes: readonly ButtonHeroNote[];
  readonly elapsedMs: number;
  readonly countdownMs: number;
  /** How long a note takes to cross the track, so the view can draw it. */
  readonly travelMs: number;
  readonly resolved: readonly number[];
  /** How much of each spin riff has been spun so far, 0-1, by note index (0 for presses). */
  readonly riffProgress: readonly number[];
  readonly spinning: boolean;
  readonly combo: number;
  readonly bestCombo: number;
  readonly perfect: number;
  readonly good: number;
  readonly misses: number;
  readonly accuracyPercent: number;
  readonly lastJudgment: ButtonHeroJudgment | null;
  readonly lastJudgmentAtMs: number;
  readonly lastPoints: number;
  readonly score: number;
}
export interface ButtonHeroOptions {
  readonly difficulty?: ButtonHeroDifficulty;
  readonly notes?: readonly ButtonHeroNote[];
}

// Slow on purpose: every note is on screen for several seconds, so a child can read the word and get ready.
const SETTINGS = {
  easy: { gapMs: 2_600, goodMs: 450, perfectMs: 220, riffMs: 1_800, travelMs: 6_500 },
  normal: { gapMs: 2_000, goodMs: 350, perfectMs: 170, riffMs: 1_500, travelMs: 5_200 },
  hard: { gapMs: 1_500, goodMs: 280, perfectMs: 140, riffMs: 1_200, travelMs: 4_200 },
} as const;
const COUNTDOWN_MS = 3_000;
const SONG: readonly ButtonHeroMove[] = ['click', 'left', 'right', 'strum', 'click', 'spin', 'left', 'strum',
  'right', 'click', 'spin', 'strum', 'left', 'right', 'click', 'strum', 'spin', 'click'];
/** A toy spin counts as "still spinning" for this long after its last event. */
const SPIN_HOLD_MS = 350;
const RIFF_POINTS = 150;
// Pushing the slider to either end is a strum.
const SWITCH_MOVES: Readonly<Partial<Record<string, ButtonHeroMove>>> = { clicker: 'click', navLeft: 'left',
  navRight: 'right', sliderLow: 'strum', sliderHigh: 'strum' };

function buildSong(settings: (typeof SETTINGS)[ButtonHeroDifficulty]): ButtonHeroNote[] {
  let atMs = COUNTDOWN_MS + 2_000;
  return SONG.map((move) => {
    const holdMs = move === 'spin' ? settings.riffMs : 0;
    const note = { move, atMs, holdMs };
    atMs += settings.gapMs + holdMs;
    return note;
  });
}

export function createButtonHeroGame(options: ButtonHeroOptions = {}) {
  const difficulty = options.difficulty ?? 'normal';
  const settings = SETTINGS[difficulty];
  const notes = options.notes ?? buildSong(settings);
  if (notes.some((note, index) => !Number.isFinite(note.atMs) || note.atMs < COUNTDOWN_MS
    || !BUTTON_HERO_MOVES.includes(note.move) || !Number.isFinite(note.holdMs) || note.holdMs < 0
    || (note.move === 'spin') !== (note.holdMs > 0)
    || (index > 0 && note.atMs < (notes[index - 1]?.atMs ?? 0)))) {
    throw new Error('notes must be ordered, and only spin notes (all of them) have a holdMs');
  }
  const last = notes[notes.length - 1];
  const durationMs = (last ? last.atMs + last.holdMs : COUNTDOWN_MS) + settings.goodMs + 1_200;
  return defineGame<ButtonHeroState, ButtonHeroAction>({
    id: `button-hero-${difficulty}`,
    title: 'Button Hero',
    description: 'Click, press left or right, strum the slider, or spin as each note reaches the ring.',
    skills: ['press', 'slide', 'spin', 'screw'],
    needsToy: false,
    durationMs,
    starThresholds: [100, 700, 1_400],
    create(session: GameSession) {
      const resolved = new Set<number>();
      const spunMs = notes.map(() => 0);
      let combo = 0;
      let bestCombo = 0;
      let perfect = 0;
      let good = 0;
      let misses = 0;
      let lastJudgment: ButtonHeroJudgment | null = null;
      let lastJudgmentAtMs = Number.NEGATIVE_INFINITY;
      let lastPoints = 0;
      let elapsedMs = 0;
      let spinHeld = false;
      let spinUntilMs = Number.NEGATIVE_INFINITY;
      const isSpinning = (nowMs: number) => spinHeld || nowMs < spinUntilMs;

      const judge = (judgment: ButtonHeroJudgment, nowMs: number, points: number) => {
        lastJudgment = judgment;
        lastJudgmentAtMs = nowMs;
        lastPoints = points;
        if (judgment === 'perfect') perfect++;
        else if (judgment === 'good') good++;
        else if (judgment === 'miss') misses++;
        if (judgment === 'perfect' || judgment === 'good') {
          combo++;
          bestCombo = Math.max(bestCombo, combo);
        } else if (judgment === 'miss') combo = 0;
        if (points > 0) {
          session.score.add(points);
          session.score.countAction();
        }
      };

      // Spin riffs collect spinning time inside their window; presses that slip past their window are missed.
      const advance = (nowMs: number) => {
        const fromMs = elapsedMs;
        const spinning = isSpinning(nowMs);
        notes.forEach((note, index) => {
          if (resolved.has(index)) return;
          if (note.move !== 'spin') {
            if (nowMs > note.atMs + settings.goodMs) {
              resolved.add(index);
              judge('miss', nowMs, 0);
            }
            return;
          }
          const startMs = note.atMs - settings.goodMs;
          const endMs = note.atMs + note.holdMs;
          if (spinning) spunMs[index] = (spunMs[index] ?? 0) + Math.max(0, Math.min(nowMs, endMs) - Math.max(fromMs, startMs));
          if (nowMs <= endMs) return;
          resolved.add(index);
          // Partial credit: every bit of spinning earns points, even when it isn't enough for a combo.
          const fraction = Math.min(1, (spunMs[index] ?? 0) / note.holdMs);
          const points = Math.round(fraction * RIFF_POINTS / 10) * 10;
          judge(fraction >= 0.75 ? 'perfect' : fraction >= 0.25 ? 'good' : 'miss', nowMs, points);
          // Spinning already rumbles on the toy; a well-played riff adds a little cheer on top.
          if (fraction >= 0.75) session.feedback('success');
        });
        elapsedMs = Math.max(elapsedMs, nowMs);
      };

      const press = (move: ButtonHeroMove) => {
        const nowMs = session.elapsedMs();
        advance(nowMs);
        let selected = -1;
        let nearest = Number.POSITIVE_INFINITY;
        notes.forEach((note, index) => {
          const distance = Math.abs(nowMs - note.atMs);
          if (note.move === move && note.holdMs === 0 && !resolved.has(index) && distance <= settings.goodMs
            && distance < nearest) {
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
        judge(isPerfect ? 'perfect' : 'good', nowMs,
          (isPerfect ? 100 : 50) + Math.min(50, Math.floor(combo / 5) * 10));
        // The toy taps on every press by itself; a perfect hit adds a little cheer on top.
        if (isPerfect) session.feedback('success');
      };

      const setSpinHeld = (held: boolean) => {
        advance(session.elapsedMs());
        spinHeld = held;
      };

      return {
        getState: () => ({ notes, elapsedMs, countdownMs: Math.max(0, COUNTDOWN_MS - elapsedMs),
          travelMs: settings.travelMs, resolved: [...resolved],
          riffProgress: notes.map((note, index) => note.holdMs > 0 ? Math.min(1, (spunMs[index] ?? 0) / note.holdMs) : 0),
          spinning: isSpinning(elapsedMs), combo, bestCombo, perfect, good, misses,
          accuracyPercent: resolved.size === 0 ? 100 : Math.round((perfect + good) * 100 / resolved.size),
          lastJudgment, lastJudgmentAtMs, lastPoints, score: session.score.score }),
        onTick(nowMs) { advance(nowMs); },
        onAction(action) {
          if (action.type !== 'button' || !BUTTON_HERO_MOVES.includes(action.move)) return;
          if (action.move === 'spin') setSpinHeld(action.pressed);
          else if (action.pressed) press(action.move);
        },
        // The real toy: the clicker and nav keys are presses, the slider strums, and turning the knob (or the
        // spinner) keeps a riff going.
        onEvent(event: FidgetEvent) {
          if (event.type === 'switchDown') {
            const move = SWITCH_MOVES[event.switchId];
            if (move) press(move);
          } else if (event.type === 'spin' || event.type === 'screw') {
            const nowMs = session.elapsedMs();
            advance(nowMs);
            spinUntilMs = nowMs + SPIN_HOLD_MS;
          }
        },
        onFinish() {
          advance(durationMs);
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
