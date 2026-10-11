import { describe, expect, it } from 'vitest';
import { NOTE_STYLES, noteCenterX } from './note-highway';

describe('horizontal note highway', () => {
  it('maps the four existing buttons to distinct face styles', () => {
    expect(NOTE_STYLES.map(style => [style.name, style.key])).toEqual([
      ['Red', 'A'], ['Teal', 'S'], ['Yellow', 'D'], ['Purple', 'F'],
    ]);
  });

  it('places a note at the target at its scheduled time regardless of frame step', () => {
    expect(noteCenterX(4000, 2000, 2000, 600, 70)).toBe(600);
    expect(noteCenterX(4000, 3875, 2000, 600, 70)).toBe(103.125);
    expect(noteCenterX(4000, 4000, 2000, 600, 70)).toBe(70);
    expect(noteCenterX(4000, 4200, 2000, 600, 70)).toBe(17);
  });
});
