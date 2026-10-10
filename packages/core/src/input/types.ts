import type { FidgetModeName, SwitchId } from '@jimmyit/protocol';

export type FidgetModeState = FidgetModeName | 'unknown';
export type SwitchStates = Readonly<Record<SwitchId, boolean>>;

/** Everything the toy is reporting right now, in app-friendly units. */
export interface FidgetState {
  readonly mode: FidgetModeState;
  readonly switches: SwitchStates;
  readonly spinner: {
    /** 0 to <360, absolute position of the spinner. */
    readonly angleDeg: number;
    /** Signed degrees turned since this connection started. Positive = clockwise. */
    readonly totalDeg: number;
  };
  readonly screw: {
    /** Signed detents turned since this connection started. Positive = tighten. */
    readonly position: number;
  };
  readonly batteryPercent: number | null;
  readonly charging: boolean;
  readonly clockSet: boolean;
  readonly standaloneGameRunning: boolean;
  /** App clock time of the packet this state came from; null before the first packet. */
  readonly updatedAt: number | null;
}

interface EventBase {
  /** App clock time (ms) when the packet carrying this event arrived. */
  readonly at: number;
}

/** Discrete things that happened, derived by diffing input packets. */
export type FidgetEvent =
  | (EventBase & { readonly type: 'switchDown'; readonly switchId: SwitchId })
  | (EventBase & { readonly type: 'switchUp'; readonly switchId: SwitchId; readonly heldMs: number })
  | (EventBase & { readonly type: 'spin'; readonly deltaDeg: number; readonly totalDeg: number })
  | (EventBase & { readonly type: 'screw'; readonly deltaDetents: number; readonly position: number })
  | (EventBase & { readonly type: 'modeChange'; readonly mode: FidgetModeState });

export type FidgetEventType = FidgetEvent['type'];
export type FidgetEventOf<T extends FidgetEventType> = Extract<FidgetEvent, { type: T }>;

export function isSwitchDown(event: FidgetEvent, switchId?: SwitchId): event is FidgetEventOf<'switchDown'> {
  return event.type === 'switchDown' && (switchId === undefined || event.switchId === switchId);
}

export function isSwitchUp(event: FidgetEvent, switchId?: SwitchId): event is FidgetEventOf<'switchUp'> {
  return event.type === 'switchUp' && (switchId === undefined || event.switchId === switchId);
}

export const INITIAL_FIDGET_STATE: FidgetState = {
  mode: 'unknown',
  switches: {
    clicker: false,
    navLeft: false,
    navRight: false,
    rocker: false,
    screwHome: false,
    screwOut: false,
    sliderLow: false,
    sliderHigh: false,
    stylusStowed: false,
  },
  spinner: { angleDeg: 0, totalDeg: 0 },
  screw: { position: 0 },
  batteryPercent: null,
  charging: false,
  clockSet: false,
  standaloneGameRunning: false,
  updatedAt: null,
};
