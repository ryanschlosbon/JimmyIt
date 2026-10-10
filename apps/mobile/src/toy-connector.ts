import { Platform } from 'react-native';
import type { ToyConnector } from '@jimmyit/app-kit';
import type { SimulatedToy } from '@jimmyit/dev-toy';
import { createToyBluetoothConnector } from './bluetooth';

/**
 * Where the toy comes from:
 * - 'virtual': the on-screen virtual toy (@jimmyit/dev-toy). Development builds and web previews.
 * - 'bluetooth': the real toy. Release builds on a phone or tablet.
 *
 * To try the real toy in a development build, start Metro with
 * EXPO_PUBLIC_JIMMY_TOY=bluetooth (needs a development build, not Expo Go).
 */
export type ToySource = 'virtual' | 'bluetooth';

export const TOY_SOURCE: ToySource = Platform.OS === 'web'
  ? 'virtual'
  : process.env.EXPO_PUBLIC_JIMMY_TOY === 'bluetooth' || process.env.EXPO_PUBLIC_JIMMY_TOY === 'virtual'
    ? process.env.EXPO_PUBLIC_JIMMY_TOY
    : __DEV__ ? 'virtual' : 'bluetooth';

export interface ToySetup {
  readonly connector: ToyConnector | null;
  /** Only for the virtual toy: drive it from screens and the DevToyPanel. */
  readonly simulator: SimulatedToy | null;
}

export function createToySetup(): ToySetup {
  if (TOY_SOURCE === 'bluetooth') return { connector: createToyBluetoothConnector(), simulator: null };
  // require, not import: keeps the simulator out of release bundles.
  const { createSimulatedToy } = require('@jimmyit/dev-toy') as typeof import('@jimmyit/dev-toy');
  const simulator = createSimulatedToy();
  return { connector: simulator.connector, simulator };
}

/** The on-screen virtual toy panel, only where the virtual toy is in use. */
export function loadDevToyPanel(): typeof import('@jimmyit/dev-toy').DevToyPanel | null {
  if (TOY_SOURCE !== 'virtual') return null;
  return (require('@jimmyit/dev-toy') as typeof import('@jimmyit/dev-toy')).DevToyPanel;
}
