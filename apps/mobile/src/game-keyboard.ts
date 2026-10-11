import type { GameInputEvent } from './game-input';

export function attachGameKeyboard(_game: 'buttonHero' | 'knobQuest',
  _onInput: (event: GameInputEvent) => void): () => void {
  return () => undefined;
}
