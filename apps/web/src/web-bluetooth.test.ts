import { describe, expect, it } from 'vitest';
import { createWebBluetoothConnector, isWebBluetoothAvailable } from './web-bluetooth';

describe('web Bluetooth capability', () => {
  it('is unavailable without a secure browser Bluetooth API', () => {
    expect(isWebBluetoothAvailable()).toBe(false);
    expect(createWebBluetoothConnector()).toBeNull();
  });
});
