/** Game-specific face colors stay separate from the app's chrome palette. */
export const NOTE_STYLES = [
  { name: 'Red', fill: '#EF6B62', face: '#7A0B5A', key: 'A' },
  { name: 'Teal', fill: '#67D0B1', face: '#7A0B5A', key: 'S' },
  { name: 'Yellow', fill: '#F5C84C', face: '#7A0B5A', key: 'D' },
  { name: 'Purple', fill: '#B69BE8', face: '#542879', key: 'F' },
] as const;

/** At the scheduled time the note center is exactly on the stationary target. */
export function noteCenterX(atMs: number, elapsedMs: number, travelMs: number,
  trackWidth: number, targetX: number): number {
  return targetX + (atMs - elapsedMs) / travelMs * (trackWidth - targetX);
}
