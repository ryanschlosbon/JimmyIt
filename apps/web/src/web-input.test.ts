import { describe, expect, it, vi } from 'vitest';
import { handlePracticeKey } from './web-input';

describe('web practice keys', () => {
  it('maps keys to toy moves without repeated or modified input', () => {
    const controls = { tap: vi.fn(), spin: vi.fn(), turnScrew: vi.fn() };
    const preventDefault = vi.fn();
    const event = (key: string, repeat = false, ctrlKey = false) => ({
      key, repeat, ctrlKey, altKey: false, metaKey: false, preventDefault,
    });
    expect(handlePracticeKey(event('j'), controls)).toBe(true);
    expect(handlePracticeKey(event('K'), controls)).toBe(true);
    expect(handlePracticeKey(event('l'), controls)).toBe(true);
    expect(handlePracticeKey(event('j', true), controls)).toBe(false);
    expect(handlePracticeKey(event('j', false, true), controls)).toBe(false);
    expect(handlePracticeKey(event('x'), controls)).toBe(false);
    expect(controls.tap).toHaveBeenCalledExactlyOnceWith('clicker');
    expect(controls.spin).toHaveBeenCalledExactlyOnceWith(90);
    expect(controls.turnScrew).toHaveBeenCalledExactlyOnceWith(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
