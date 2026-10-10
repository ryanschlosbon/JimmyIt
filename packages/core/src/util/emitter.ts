export type Unsubscribe = () => void;
export type Listener<T> = (value: T) => void;

export interface Emitter<T> {
  emit(value: T): void;
  subscribe(listener: Listener<T>): Unsubscribe;
  clear(): void;
}

/**
 * Minimal synchronous event emitter. Every listener runs even if an earlier one
 * throws; the first error is rethrown afterwards so it is never swallowed.
 */
export function createEmitter<T>(): Emitter<T> {
  const listeners = new Set<Listener<T>>();
  return {
    emit(value) {
      let failed = false;
      let firstError: unknown;
      for (const listener of [...listeners]) {
        try {
          listener(value);
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
      if (failed) throw firstError;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      listeners.clear();
    },
  };
}
