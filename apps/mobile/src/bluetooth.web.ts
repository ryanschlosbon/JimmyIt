import type { ToyConnector } from '@jimmyit/app-kit';

/** Browsers can't reach the toy; web previews use the virtual toy instead. */
export function createToyBluetoothConnector(): ToyConnector | null {
  return null;
}
