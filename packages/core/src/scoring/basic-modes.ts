import { BasicModeId, type BasicModeName } from '@jimmyit/protocol';
import type { StarThresholds } from './scoring-helpers';

/** App-side description of a game the fidget runs and scores by itself. */
export interface BasicModeInfo {
  readonly modeId: number;
  readonly name: BasicModeName;
  readonly gameId: string;
  readonly title: string;
  /** The fidget does not send stars; the app derives them from these. */
  readonly starThresholds: StarThresholds;
}

// Scoring rules live in firmware/jimmyit_fidget/src/basic_modes.cpp.
export const BASIC_MODES: readonly BasicModeInfo[] = [
  {
    modeId: BasicModeId.freePlay,
    name: 'freePlay',
    gameId: 'fidget-free-play',
    title: 'Free Play',
    starThresholds: [200, 600, 1200],
  },
  {
    modeId: BasicModeId.spinCount,
    name: 'spinCount',
    gameId: 'fidget-spin-count',
    title: 'Spin Count',
    // 20 points per full turn: 5, 15 and 30 turns, as when a turn paid 10.
    starThresholds: [100, 300, 600],
  },
];

export function basicModeById(modeId: number): BasicModeInfo | undefined {
  return BASIC_MODES.find((mode) => mode.modeId === modeId);
}

/** Game id for a fidget mode, including modes newer than this app. */
export function gameIdForBasicMode(modeId: number): string {
  return basicModeById(modeId)?.gameId ?? `fidget-mode-${modeId}`;
}
