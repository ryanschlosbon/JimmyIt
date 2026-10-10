// Wire constants for protocol v1. PROTOCOL.md is the spec; keep these in step
// with it and with firmware/jimmyit_fidget/src/fidget_protocol.h.
//
// Naming: `…Bit` objects hold bit indexes, `…Flag` and `Capability` objects
// hold masks.

export const PROTOCOL_VERSION = 1;

export const MAX_PAYLOAD_BYTES = 20;
export const MAX_TEXT_LENGTH = 18;
export const MAX_APP_NAME_LENGTH = 15;
export const MAX_HAPTIC_EFFECTS = 8;
export const MAX_HAPTIC_EFFECT_ID = 123;
export const DISPLAY_LINE_COUNT = 4;
export const MAX_STARS = 3;

export const INPUT_PACKET_BYTES = 18;
export const DEVICE_INFO_BYTES = 16;

export const SPINNER_COUNTS_PER_TURN = 4096;
export const BATTERY_UNKNOWN = 255;

export const SwitchBit = {
  clicker: 0,
  navLeft: 1,
  navRight: 2,
  rocker: 3,
  screwHome: 4,
  screwOut: 5,
  sliderLow: 6,
  sliderHigh: 7,
  stylusStowed: 8,
  // Bit 9 was the shirt-button flap (removed from the toy); now reserved, always 0.
} as const;
export type SwitchId = keyof typeof SwitchBit;
export const SWITCH_IDS: readonly SwitchId[] = [
  'clicker',
  'navLeft',
  'navRight',
  'rocker',
  'screwHome',
  'screwOut',
  'sliderLow',
  'sliderHigh',
  'stylusStowed',
];

export const FidgetMode = {
  standalone: 1,
  app: 2,
} as const;
export type FidgetModeName = keyof typeof FidgetMode;

export const InputFlag = {
  clockSet: 0x01,
  charging: 0x02,
  standaloneGame: 0x04,
  /** A phone is connected but the child hasn't said yes on the toy yet. */
  awaitingApproval: 0x08,
} as const;

export const RecordFlag = {
  clockSet: 0x01,
  completed: 0x02,
  newBest: 0x04,
} as const;

export const Capability = {
  haptics: 0x01,
  display: 0x02,
  scoreLog: 0x04,
  standaloneModes: 0x08,
  /** Plays animations and haptics for scoreEvent commands, and sends its own. */
  scoreEvents: 0x10,
  /** Asks the child before accepting a phone; the app must send hello. */
  approval: 0x20,
} as const;
export type CapabilityName = keyof typeof Capability;

export const CommandOpcode = {
  setTime: 0x01,
  setMode: 0x02,
  hello: 0x03,
  haptic: 0x10,
  showText: 0x20,
  showScore: 0x21,
  showProgress: 0x22,
  clearDisplay: 0x23,
  scoreEvent: 0x24,
  syncRequest: 0x30,
  syncAck: 0x31,
  setBest: 0x32,
} as const;

export const MessageType = {
  record: 0x01,
  syncDone: 0x02,
  scoreEvent: 0x03,
  approval: 0x04,
  error: 0x7f,
} as const;

export const ErrorCode = {
  unknownOpcode: 1,
  badLength: 2,
  badValue: 3,
  busy: 4,
  /** The child hasn't approved this phone yet. */
  notApproved: 5,
} as const;

/** Moments in a game that the toy (and the app) celebrate. See PROTOCOL.md "Score events". */
export const ScoreEventKind = {
  gameStart: 1,
  points: 2,
  milestone: 3,
  newBest: 4,
  gameEnd: 5,
} as const;
export type ScoreEventKindName = keyof typeof ScoreEventKind;

/** A milestone event fires at every multiple of this score. */
export const POINTS_PER_MILESTONE = 100;

export const ApprovalStatus = {
  declined: 0,
  accepted: 1,
  waiting: 2,
} as const;
export type ApprovalStatusName = keyof typeof ApprovalStatus;

/** Games the fidget runs and scores on its own. Ids 1-63 are reserved for these. */
export const BasicModeId = {
  freePlay: 1,
  spinCount: 2,
} as const;
export type BasicModeName = keyof typeof BasicModeId;
