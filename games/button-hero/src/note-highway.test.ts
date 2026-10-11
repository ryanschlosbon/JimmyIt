import { describe, expect, it } from 'vitest';
import { MOVE_STYLES, noteCenterX, riffWidth } from './note-highway';

describe('note highway', () => {
  it('describes every toy move in words, with the computer key as a hint', () => {
    expect(Object.entries(MOVE_STYLES).map(([move, style]) => [move, style.word, style.key])).toEqual([
      ['click', 'Click', 'A'], ['left', 'Left', 'S'], ['right', 'Right', 'D'], ['spin', 'Spin', 'F'],
    ]);
  });

  it('places a note at the target at its scheduled time regardless of frame step', () => {
    expect(noteCenterX(4000, 2000, 2000, 600, 70)).toBe(600);
    expect(noteCenterX(4000, 3875, 2000, 600, 70)).toBe(103.125);
    expect(noteCenterX(4000, 4000, 2000, 600, 70)).toBe(70);
    expect(noteCenterX(4000, 4200, 2000, 600, 70)).toBe(17);
  });

  it('draws a spin riff as long as it lasts at the track speed', () => {
    expect(riffWidth(1000, 2000, 600, 70)).toBe(265);
  });
});
