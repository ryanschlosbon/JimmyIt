import {
  type Clock,
  connectFidgetClient,
  createEmitter,
  type FidgetClient,
  type FidgetInfo,
  type FidgetTransport,
  FidgetDeclinedError,
  FidgetTimeoutError,
  type Listener,
  ProtocolVersionMismatchError,
  type ScoreEvent,
  type Scheduler,
  type ScoreRepository,
  startScoreSync,
  type SyncResult,
  systemClock,
  systemScheduler,
  type Unsubscribe,
} from '@jimmyit/core';

/**
 * Where a toy connection comes from. The app picks one at startup: the
 * simulated toy (@jimmyit/dev-toy) today, Bluetooth (@jimmyit/ble-react-native)
 * once the hardware is ready. Nothing above this interface changes between them.
 */
export interface ToyConnector {
  readonly kind: 'simulated' | 'bluetooth';
  /** Finds the toy and returns a connected transport, or throws. */
  connect(): Promise<FidgetTransport>;
}

/** 'awaitingApproval': the toy is asking the child "connect to this phone?". */
export type ConnectionStatus = 'disconnected' | 'searching' | 'awaitingApproval' | 'connected';

/** 'declined': the child said no on the toy, or didn't answer in time. */
export type ConnectionErrorKind = 'unavailable' | 'notFound' | 'versionMismatch' | 'declined' | 'syncFailed' | 'lost';

/** Who this app is to the toy: it shows the name and remembers the id. */
export interface AppIdentity {
  readonly appId: number;
  readonly appName: string;
}

/** `kind` is for the app to pick child-friendly wording; `detail` is for logs. */
export interface ConnectionError {
  readonly kind: ConnectionErrorKind;
  readonly detail: string;
}

export interface ConnectionSnapshot {
  readonly status: ConnectionStatus;
  readonly connectorKind: ToyConnector['kind'] | null;
  readonly info: FidgetInfo | null;
  /** Result of pulling the toy's offline games when it last connected. */
  readonly lastSync: SyncResult | null;
  readonly error: ConnectionError | null;
}

/** Owns the one toy connection: connect, cancel, disconnect, and score sync on connect. */
export interface ConnectionManager {
  /** Same object until something changes, so it is safe for useSyncExternalStore. */
  getSnapshot(): ConnectionSnapshot;
  subscribe(listener: Listener<void>): Unsubscribe;
  /** The live client while connected, for games and toy state. */
  getClient(): FidgetClient | null;
  /** Connects (cancelling any attempt in progress), then syncs the toy's offline scores. */
  connect(): Promise<void>;
  /** Also cancels a search in progress. */
  disconnect(): Promise<void>;
  clearError(): void;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createConnectionManager(options: {
  readonly connector: ToyConnector | null;
  readonly repository: ScoreRepository;
  /** Loaded before every connection; see createJimmyServices for how it is kept. */
  readonly identity?: () => Promise<AppIdentity>;
  /** Moments from games the toy is running by itself while connected. */
  readonly onToyScoreEvent?: (event: ScoreEvent) => void;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
}): ConnectionManager {
  const { connector, repository } = options;
  const clock = options.clock ?? systemClock;
  const scheduler = options.scheduler ?? systemScheduler;
  const changes = createEmitter<void>();

  let snapshot: ConnectionSnapshot = {
    status: 'disconnected',
    connectorKind: connector?.kind ?? null,
    info: null,
    lastSync: null,
    error: null,
  };
  let client: FidgetClient | null = null;
  let cleanups: Unsubscribe[] = [];
  // Bumped by every connect/disconnect so a slow, superseded attempt cleans up after itself.
  let attempt = 0;

  function update(patch: Partial<ConnectionSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    changes.emit();
  }

  function release(): void {
    for (const cleanup of cleanups.splice(0)) cleanup();
    client = null;
  }

  async function disconnect(): Promise<void> {
    attempt++;
    const previous = client;
    release();
    if (snapshot.status !== 'disconnected') update({ status: 'disconnected', info: null });
    await previous?.disconnect().catch(() => undefined);
  }

  async function connect(): Promise<void> {
    await disconnect();
    const current = ++attempt;
    const stale = () => current !== attempt;
    if (!connector) {
      update({ error: { kind: 'unavailable', detail: 'this build has no toy connector' } });
      return;
    }
    update({ status: 'searching', error: null });

    let transport: FidgetTransport;
    try {
      transport = await connector.connect();
    } catch (error) {
      if (!stale()) update({ status: 'disconnected', error: { kind: 'notFound', detail: describe(error) } });
      return;
    }
    if (stale()) {
      await transport.disconnect().catch(() => undefined);
      return;
    }

    let next: FidgetClient;
    try {
      const identity = options.identity ? await options.identity() : undefined;
      next = await connectFidgetClient(transport, {
        clock,
        scheduler,
        ...(identity ? { appId: identity.appId, appName: identity.appName } : {}),
        onApprovalPending: () => {
          if (!stale()) update({ status: 'awaitingApproval' });
        },
      });
    } catch (error) {
      await transport.disconnect().catch(() => undefined);
      if (!stale()) {
        const kind: ConnectionErrorKind =
          error instanceof ProtocolVersionMismatchError
            ? 'versionMismatch'
            : error instanceof FidgetDeclinedError || error instanceof FidgetTimeoutError
              ? 'declined'
              : 'notFound';
        update({ status: 'disconnected', error: { kind, detail: describe(error) } });
      }
      return;
    }
    if (stale()) {
      await next.disconnect().catch(() => undefined);
      return;
    }

    client = next;
    cleanups.push(
      next.onDisconnect((error) => {
        if (client !== next) return;
        release();
        update({ status: 'disconnected', info: null, error: error ? { kind: 'lost', detail: describe(error) } : null });
      }),
    );
    if (options.onToyScoreEvent) cleanups.push(next.onScoreEvent(options.onToyScoreEvent));
    update({ status: 'connected', info: next.info });

    try {
      const sync = await startScoreSync(next, repository, {
        clock,
        onError: (error) => update({ error: { kind: 'syncFailed', detail: describe(error) } }),
      });
      if (client !== next) {
        sync.stop();
        return;
      }
      cleanups.push(sync.stop);
      update({ lastSync: sync.initial });
    } catch (error) {
      if (client === next) update({ error: { kind: 'syncFailed', detail: describe(error) } });
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => changes.subscribe(listener),
    getClient: () => client,
    connect,
    disconnect,
    clearError() {
      if (snapshot.error) update({ error: null });
    },
  };
}
