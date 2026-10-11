export interface PracticeKeys {
  readonly key: string;
  readonly repeat: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  preventDefault(): void;
}

export interface PracticeControls {
  tap(switchId: 'clicker'): void;
  spin(degrees: number): void;
  turnScrew(detents: number): void;
}

/** Web-only keyboard mapping for the shared timed game. */
export function handlePracticeKey(event: PracticeKeys, controls: PracticeControls): boolean {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return false;
  const key = event.key.toLowerCase();
  if (key === ' ' || key === 'j') {
    event.preventDefault();
    controls.tap('clicker');
  } else if (key === 'k') {
    controls.spin(90);
  } else if (key === 'l') {
    controls.turnScrew(1);
  } else return false;
  return true;
}
