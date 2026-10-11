// The app's game registry: which games exist and how screens refer to them.
// Game authors add one import and one entry here (see games/AGENTS.md).
import { createGameCatalog } from '@jimmyit/app-kit';
import type { ScoreRecord } from '@jimmyit/core';
import { freeDrawing, shapeChallenge } from '@jimmyit/game-drawing';
import { createButtonHeroGame } from '@jimmyit/game-button-hero';
import { createKnobQuestGame } from '@jimmyit/game-knob-quest';
import { createShapeRecognitionGame } from '@jimmyit/game-shape-recognition';
import { createTapQuestGame, type Point, type RecentAttempt, type TapQuestMode } from '@jimmyit/game-tap-quest';
import { createTimedPractice, TIMED_PRACTICE_DURATIONS_MS } from '@jimmyit/game-timed-practice';
import type { GameArtName } from './components/GameArt';
import type { BannerColorName } from './design/palettes';

export type Activity = 'drawing' | 'shapes';

export const DRAWING_GAMES = { drawing: freeDrawing, shapes: shapeChallenge } as const;
/** The canvas guides four shapes; its strokes feed this headless recognition game. */
export const SHAPE_CHALLENGE_GAME = createShapeRecognitionGame({
  targets: ['circle', 'triangle', 'square', 'rectangle'],
});

export const TIMED_PRACTICE_SECONDS = TIMED_PRACTICE_DURATIONS_MS.map((ms) => ms / 1000);
const timedPractice = new Map<number, ReturnType<typeof createTimedPractice>>(
  TIMED_PRACTICE_DURATIONS_MS.map((ms) => [ms, createTimedPractice(ms)]),
);
export function timedPracticeGame(durationMs: number) {
  return timedPractice.get(durationMs) ?? createTimedPractice(durationMs);
}

export const TAP_QUEST_MODES: readonly { readonly mode: TapQuestMode; readonly title: string; readonly caption: string }[] = [
  { mode: 'precision', title: 'Precision', caption: 'Touch each circle before it moves on.' },
  { mode: 'trace', title: 'Trace', caption: 'Follow the path with your stylus.' },
  { mode: 'memory', title: 'Memory', caption: 'Watch the order, then tap it back.' },
  { mode: 'calm', title: 'Calm', caption: 'No timer. Tap circles at your own pace.' },
];

const MAX_TAP_QUEST_LEVEL = 5;

/**
 * Tap Quest for this child: starts at the level of their last game in this mode
 * and lets the game adapt from their last five (at most one level per game).
 * `records` is newest first, as useScores() returns them.
 */
export function tapQuestGame(mode: TapQuestMode, records: readonly ScoreRecord[], patternSeed = 0,
  patternPositions?: readonly Point[]) {
  const mine = records.filter((record) => record.gameId === `tap-quest-${mode}`).slice(0, 5).reverse();
  const lastLevel = mine[mine.length - 1]?.metrics.level ?? 1;
  const recentAttempts: RecentAttempt[] = mine
    .filter((record) => (record.metrics.touchAttempts ?? 0) > 0)
    .map((record) => ({
      accuracy: Math.min(1, (record.metrics.matchedTargets ?? 0) / (record.metrics.touchAttempts ?? 1)),
      completionRate: Math.min(1, (record.metrics.completionPercent ?? 0) / 100),
    }));
  const level = Math.max(1, Math.min(MAX_TAP_QUEST_LEVEL, Math.round(lastLevel)));
  return createTapQuestGame({ mode, level, recentAttempts, patternSeed, patternPositions });
}

/** Titles and facts for menus and scoreboards, including games the toy plays by itself. */
export const GAME_CATALOG = createGameCatalog([
  freeDrawing,
  shapeChallenge,
  createTimedPractice(),
  ...TAP_QUEST_MODES.map(({ mode }) => createTapQuestGame({ mode })),
  createShapeRecognitionGame(),
  createButtonHeroGame(),
  createKnobQuestGame(),
]);

/** The games on the play screen, in shelf order. Each is one banner (see DESIGN.md "Game banners"). */
export type ShelfGameId = 'timed' | 'tapQuest' | 'drawing' | 'shapes' | 'buttonHero' | 'knobQuest';

/** A choice shown as a chip on a banner, like a time limit or a mode. */
export interface ShelfOption {
  readonly value: string;
  readonly label: string;
  readonly accessibilityLabel: string;
  /** Replaces the banner's tagline while this option is chosen. */
  readonly caption?: string;
}

export interface ShelfGame {
  readonly id: ShelfGameId;
  readonly title: string;
  /** One short line on the banner. */
  readonly tagline: string;
  /** The longer "how to play" tip behind the banner's info button. */
  readonly howTo: string;
  readonly art: GameArtName;
  readonly color: BannerColorName;
  /** What the child plays with; Jimmy games need the toy connected. */
  readonly uses: 'jimmy' | 'stylus' | 'touch';
  readonly options: readonly ShelfOption[];
  /** Which number the banner shows: the best score, or how many times it was played. */
  readonly stat: 'best' | 'count';
  /** The saved game id the banner's number comes from, for the chosen option. */
  readonly scoreGameId: (option: string | null) => string;
}

function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const PLAY_SHELF: readonly ShelfGame[] = [
  {
    id: 'timed', title: 'Timed Run', art: 'stopwatch', color: 'mint', uses: 'jimmy', stat: 'best',
    tagline: 'Every move on Jimmy scores!',
    howTo: 'Pick how long to play, then press Play. Press the button, spin the dial and turn the screw on '
      + 'Jimmy. Every move earns points. You can pause whenever you like.',
    options: TIMED_PRACTICE_SECONDS.map((seconds) => ({
      value: String(seconds * 1000), label: clockLabel(seconds), accessibilityLabel: `${seconds} seconds`,
    })),
    scoreGameId: () => 'timed-motor-practice',
  },
  {
    id: 'tapQuest', title: 'Tap Quest', art: 'target', color: 'lilac', uses: 'stylus', stat: 'best',
    tagline: 'Steady taps, paths and patterns.',
    howTo: 'Choose a way to play, then press Play. Touch the circles with your stylus. Near misses still '
      + 'count, and the game gets easier or harder to match how you are doing.',
    options: TAP_QUEST_MODES.map(({ mode, title, caption }) => ({
      value: mode, label: title, accessibilityLabel: title, caption,
    })),
    scoreGameId: (option) => `tap-quest-${option ?? 'precision'}`,
  },
  {
    id: 'drawing', title: 'Drawing', art: 'brush', color: 'peach', uses: 'touch', stat: 'count',
    tagline: 'Pick a color and make something wonderful.',
    howTo: 'Draw anything you like with your finger or the stylus. Change colors and brush sizes, undo a '
      + 'line, and press All done when you are happy. There is no wrong way to create!',
    options: [],
    scoreGameId: () => freeDrawing.id,
  },
  {
    id: 'shapes', title: 'Shape Challenge', art: 'shapes', color: 'butter', uses: 'touch', stat: 'best',
    tagline: 'Draw four shapes at your own pace.',
    howTo: 'Follow the dotted circle, triangle, square and rectangle with your finger or the stylus. Take your '
      + 'time: every try earns points, and you can undo and try again.',
    options: [],
    scoreGameId: () => SHAPE_CHALLENGE_GAME.id,
  },
  {
    id: 'buttonHero', title: 'Button Hero', art: 'rhythm', color: 'rhythm', uses: 'jimmy', stat: 'best',
    tagline: 'Click, strum or spin to the beat.',
    howTo: 'Do each move on Jimmy as its note reaches the ring: click the top button, press left or right, '
      + 'slide to strum, or keep turning the knob through a purple bar.',
    options: [], scoreGameId: () => 'button-hero-normal',
  },
  {
    id: 'knobQuest', title: 'Knob Quest', art: 'dualKnobs', color: 'quest', uses: 'jimmy', stat: 'best',
    tagline: 'Roll Jimmy to the flag.',
    howTo: 'Spin the spinner to roll and turn the knob to float up; faster turns push harder. Hop over holes '
      + 'and land on platforms for points.',
    options: [], scoreGameId: () => 'knob-quest',
  },
];
