import { describe, expect, it } from 'vitest';
import { dispatchGameInput } from './game-input';
import { keyboardButtonEvent } from './game-keyboard.web';

describe('game input bridge', () => {
  it('maps A, S, D, G, F to click, left, right, strum and spin', () => {
    expect(['a', 's', 'd', 'g', 'f'].map(key => keyboardButtonEvent(key))).toEqual(
      (['click', 'left', 'right', 'strum', 'spin'] as const).map(move => ({ type: 'button', source: 'keyboard', move,
        pressed: true })));
    expect(keyboardButtonEvent('F', false)).toEqual({ type: 'button', source: 'keyboard', move: 'spin', pressed: false });
    expect(keyboardButtonEvent('x')).toBeNull();
  });
  it('sends keyboard, touch, and hardware events through identical game actions', () => {
    const buttons: unknown[] = [];
    const axes: unknown[] = [];
    for (const source of ['keyboard', 'touch', 'hardware'] as const) {
      dispatchGameInput({ type: 'button', source, move: 'right', pressed: true }, action => buttons.push(action),
        action => axes.push(action));
      dispatchGameInput({ type: 'axis', source, axis: 'vertical', value: -0.5 }, action => buttons.push(action),
        action => axes.push(action));
    }
    expect(buttons).toEqual(Array(3).fill({ type: 'button', move: 'right', pressed: true }));
    expect(axes).toEqual(Array(3).fill({ type: 'axis', axis: 'vertical', value: -0.5 }));
  });
});
