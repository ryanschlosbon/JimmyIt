import { describe, expect, it } from 'vitest';
import { dispatchGameInput } from './game-input';
import { keyboardButtonEvent } from './game-keyboard.web';

describe('game input bridge', () => {
  it('maps A, S, D, F to the four demo lanes', () => {
    expect(['a', 's', 'd', 'f'].map(key => keyboardButtonEvent(key))).toEqual(
      [0, 1, 2, 3].map(lane => ({ type: 'button', source: 'keyboard', lane, pressed: true })));
    expect(keyboardButtonEvent('x')).toBeNull();
  });
  it('sends keyboard, touch, and hardware events through identical game actions', () => {
    const buttons: unknown[] = [];
    const axes: unknown[] = [];
    for (const source of ['keyboard', 'touch', 'hardware'] as const) {
      dispatchGameInput({ type: 'button', source, lane: 2, pressed: true }, action => buttons.push(action),
        action => axes.push(action));
      dispatchGameInput({ type: 'axis', source, axis: 'vertical', value: -0.5 }, action => buttons.push(action),
        action => axes.push(action));
    }
    expect(buttons).toEqual(Array(3).fill({ type: 'button', lane: 2, pressed: true }));
    expect(axes).toEqual(Array(3).fill({ type: 'axis', axis: 'vertical', value: -0.5 }));
  });
});
