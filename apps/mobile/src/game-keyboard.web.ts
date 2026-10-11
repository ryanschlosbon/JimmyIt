import type { GameInputEvent } from './game-input';

const LANES: Readonly<Record<string, number>> = { a: 0, s: 1, d: 2, f: 3 };
const ARROWS: Readonly<Record<string, { readonly axis: 'horizontal' | 'vertical'; readonly value: number }>> = {
  ArrowLeft: { axis: 'horizontal', value: -1 }, ArrowRight: { axis: 'horizontal', value: 1 },
  ArrowUp: { axis: 'vertical', value: -1 }, ArrowDown: { axis: 'vertical', value: 1 },
};

export function keyboardButtonEvent(key: string): GameInputEvent | null {
  const lane = LANES[key.toLowerCase()];
  return lane === undefined ? null : { type: 'button', source: 'keyboard', lane, pressed: true };
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
