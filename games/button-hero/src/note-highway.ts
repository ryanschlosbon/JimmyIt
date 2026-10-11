import type { ButtonHeroMove } from './button-hero';

/**
 * How each toy move looks on a note. The word is what the child reads and `control` names the part of Jimmy that
 * plays it. Game-specific colors stay separate from the app's chrome palette.
 */
export const MOVE_STYLES: Readonly<Record<ButtonHeroMove, {
  readonly word: string; readonly action: string; readonly control: string; readonly fill: string; readonly ink: string;
}>> = {
  click: { word: 'Click', action: 'Click the top button', control: 'Top button', fill: '#EF6B62', ink: '#5C0A3F' },
  left: { word: 'Left', action: 'Press the left key', control: 'Left key', fill: '#67D0B1', ink: '#0B4A3E' },
  right: { word: 'Right', action: 'Press the right key', control: 'Right key', fill: '#F5C84C', ink: '#5A3D00' },
  strum: { word: 'Strum', action: 'Slide to strum', control: 'Slider', fill: '#7FC4F0', ink: '#08395C' },
  spin: { word: 'Spin', action: 'Keep turning the knob', control: 'Knob', fill: '#B69BE8', ink: '#3A1A66' },
};

/** At the scheduled time the note center is exactly on the stationary target. */
export function noteCenterX(atMs: number, elapsedMs: number, travelMs: number,
  trackWidth: number, targetX: number): number {
  return targetX + (atMs - elapsedMs) / travelMs * (trackWidth - targetX);
}

/** How wide a spin riff's bar is: its hold time at the track's speed. */
export function riffWidth(holdMs: number, travelMs: number, trackWidth: number, targetX: number): number {
  return holdMs / travelMs * (trackWidth - targetX);
}
