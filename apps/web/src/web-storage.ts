import type { KeyValueStore } from '@jimmyit/core';

const PREFIX = 'jimmyit.web.';

/** A separate browser namespace keeps web scores and preferences on this device. */
export function createWebStorage(storage: Storage): KeyValueStore {
  return {
    getItem: async (key) => storage.getItem(PREFIX + key),
    setItem: async (key, value) => { storage.setItem(PREFIX + key, value); },
    removeItem: async (key) => { storage.removeItem(PREFIX + key); },
  };
}
