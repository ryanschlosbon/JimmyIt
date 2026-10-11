import type { ButtonHeroMove } from '@jimmyit/game-button-hero';
import type { GameInputEvent } from './game-input';

// Web preview only: on the tablet the toy plays Button Hero.
const MOVES: Readonly<Record<string, ButtonHeroMove>> = { a: 'click', s: 'left', d: 'right', g: 'strum', f: 'spin' };
const ARROWS: Readonly<Record<string, { readonly axis: 'horizontal' | 'vertical'; readonly value: number }>> = {
  ArrowLeft: { axis: 'horizontal', value: -1 }, ArrowRight: { axis: 'horizontal', value: 1 },
  ArrowUp: { axis: 'vertical', value: -1 }, ArrowDown: { axis: 'vertical', value: 1 },
};

export function keyboardButtonEvent(key: string, pressed = true): GameInputEvent | null {
  const move = MOVES[key.toLowerCase()];
  return move === undefined ? null : { type: 'button', source: 'keyboard', move, pressed };
}

/** The two callbacks consume the same actions sent by touch controls. */
export function attachGameKeyboard(game: 'buttonHero' | 'knobQuest',
  onInput: (event: GameInputEvent) => void): () => void {
  console.info(`[JimmyIt] ${game} input source: keyboard simulation`);
  const held = new Set<string>();
  const keyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const button = keyboardButtonEvent(key);
    if (game === 'buttonHero' && button) {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat || held.has(key)) return;
      held.add(key);
      onInput(button);
    } else if (game === 'knobQuest' && ARROWS[event.key]) {
      event.preventDefault();
      event.stopPropagation();
      if (held.has(event.key)) return;
      held.add(event.key);
      const arrow = ARROWS[event.key];
      if (arrow) onInput({ type: 'axis', source: 'keyboard', ...arrow });
    }
  };
  const keyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const release = keyboardButtonEvent(key, false);
    if (game === 'buttonHero' && release && held.has(key)) onInput(release);
    held.delete(key);
    if (game === 'knobQuest' && ARROWS[event.key]) {
      event.preventDefault();
      event.stopPropagation();
      held.delete(event.key);
      const arrow = ARROWS[event.key];
      if (!arrow) return;
      const oppositeHeld = [...held].some((heldKey) => {
        const other = ARROWS[heldKey];
        return other?.axis === arrow.axis;
      });
      const other = [...held].map((heldKey) => ARROWS[heldKey]).find((candidate) => candidate?.axis === arrow.axis);
      onInput({ type: 'axis', source: 'keyboard', axis: arrow.axis, value: oppositeHeld ? other?.value ?? 0 : 0 });
    }
  };
  window.addEventListener('keydown', keyDown, true);
  window.addEventListener('keyup', keyUp, true);
  return () => {
    window.removeEventListener('keydown', keyDown, true);
    window.removeEventListener('keyup', keyUp, true);
    if (game === 'knobQuest') {
      onInput({ type: 'axis', source: 'keyboard', axis: 'horizontal', value: 0 });
      onInput({ type: 'axis', source: 'keyboard', axis: 'vertical', value: 0 });
    }
  };
}
