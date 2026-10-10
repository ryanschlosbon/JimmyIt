import type { Unsubscribe } from '../util/emitter';

/**
 * Raw byte pipe to one connected fidget. The BLE adapter
 * (@jimmyit/ble-react-native) and the simulator (@jimmyit/fake-fidget) both
 * implement this; everything above it is shared.
 */
export interface FidgetTransport {
  read(characteristic: 'info' | 'input'): Promise<Uint8Array>;
  write(characteristic: 'command', bytes: Uint8Array): Promise<void>;
  subscribe(characteristic: 'input' | 'message', listener: (bytes: Uint8Array) => void): Unsubscribe;
  /** Fires once when the link drops, whether or not we asked for it. */
  onDisconnect(listener: (error: Error | null) => void): Unsubscribe;
  disconnect(): Promise<void>;
}
