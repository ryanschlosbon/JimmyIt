import type { ButtonHeroAction } from '@jimmyit/game-button-hero';
import type { KnobQuestAction } from '@jimmyit/game-knob-quest';

export type GameInputSource = 'keyboard' | 'touch' | 'hardware';
export type GameInputEvent =
  | { readonly type: 'button'; readonly source: GameInputSource; readonly lane: number; readonly pressed: boolean }
  | { readonly type: 'axis'; readonly source: GameInputSource; readonly axis: 'horizontal' | 'vertical';
      readonly value: number };

/** A future approved BLE bridge can publish the same events as keyboard and touch. */
export interface GameInputProvider {
  onInput(listener: (event: GameInputEvent) => void): () => void;
}

export function dispatchGameInput(event: GameInputEvent,
  onButton: (action: ButtonHeroAction) => void, onAxis: (action: KnobQuestAction) => void): void {
  if (event.type === 'button') onButton({ type: 'button', lane: event.lane, pressed: event.pressed });
  else onAxis({ type: 'axis', axis: event.axis, value: event.value });
}
