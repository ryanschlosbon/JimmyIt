import { describe, expect, it } from 'vitest';
import { MOVE_STYLES, noteCenterX, riffWidth } from './note-highway';

describe('note highway', () => {
  it('describes every toy move in words, with the part of Jimmy that plays it', () => {
    expect(Object.entries(MOVE_STYLES).map(([move, style]) => [move, style.word, style.control])).toEqual([
      ['click', 'Click', 'Top button'], ['left', 'Left', 'Left key'], ['right', 'Right', 'Right key'],
      ['strum', 'Strum', 'Slider'], ['spin', 'Spin', 'Knob'],
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
