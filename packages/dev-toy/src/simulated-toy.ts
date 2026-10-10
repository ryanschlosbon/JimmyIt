import type { ToyConnector } from '@jimmyit/app-kit';
import { type Scheduler, systemScheduler } from '@jimmyit/core';
import { createFakeFidget, type FakeFidget } from '@jimmyit/fake-fidget';

/** A simulated toy plus the connector the app uses to "find" it. */
export interface SimulatedToy {
  /** Drive it from code or the DevToyPanel: press, spin, turn the screw, play offline… */
  readonly toy: FakeFidget;
  /** Pass to createJimmyServices({ connector }) instead of the Bluetooth connector. */
  readonly connector: ToyConnector;
}

export function createSimulatedToy(
  options: {
    readonly batteryPercent?: number;
    readonly searchDelayMs?: number;
    readonly scheduler?: Scheduler;
    /** 'ask' (default) shows the toy's "connect?" question like the real toy. */
    readonly approval?: 'ask' | 'auto';
  } = {},
): SimulatedToy {
  const toy = createFakeFidget({ approval: options.approval ?? 'ask' });
  toy.setBattery(options.batteryPercent ?? 84);
  const scheduler = options.scheduler ?? systemScheduler;
  const searchDelayMs = options.searchDelayMs ?? 1200; // feels like a real Bluetooth search
  return {
    toy,
    connector: {
      kind: 'simulated',
      connect: () =>
        new Promise((resolve, reject) => {
          scheduler.after(searchDelayMs, () => {
            toy.reconnect();
            if (toy.linked) resolve(toy.transport);
            else reject(new Error('simulated toy is out of range'));
          });
        }),
    },
  };
}
