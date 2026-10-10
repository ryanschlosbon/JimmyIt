// Wire constants for protocol v1. PROTOCOL.md is the spec; keep these in step
// with it and with firmware/jimmyit_fidget/src/fidget_protocol.h.
//
// Naming: `…Bit` objects hold bit indexes, `…Flag` and `Capability` objects
// hold masks.

export const PROTOCOL_VERSION = 1;

export const MAX_PAYLOAD_BYTES = 20;
export const MAX_TEXT_LENGTH = 18;
export const MAX_HAPTIC_EFFECTS = 8;
export const MAX_HAPTIC_EFFECT_ID = 123;
export const DISPLAY_LINE_COUNT = 4;
export const MAX_STARS = 3;

export const INPUT_PACKET_BYTES = 18;
export const DEVICE_INFO_BYTES = 16;

export const SPINNER_COUNTS_PER_TURN = 4096;
export const SQUEEZE_RAW_MAX = 4095;
export const BATTERY_UNKNOWN = 255;

export const SwitchBit = {
  clicker: 0,
  navUp: 1,
  navDown: 2,
  rocker: 3,
  screwHome: 4,
  screwOut: 5,
  sliderLow: 6,
  sliderHigh: 7,
  stylusStowed: 8,
  flapButtoned: 9,
} as const;
export type SwitchId = keyof typeof SwitchBit;
export const SWITCH_IDS: readonly SwitchId[] = [
  'clicker',
  'navUp',
  'navDown',
  'rocker',
  'screwHome',
  'screwOut',
  'sliderLow',
  'sliderHigh',
  'stylusStowed',
  'flapButtoned',
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
} as const;
export type CapabilityName = keyof typeof Capability;

export const CommandOpcode = {
  setTime: 0x01,
  setMode: 0x02,
  haptic: 0x10,
  showText: 0x20,
  showScore: 0x21,
  showProgress: 0x22,
  clearDisplay: 0x23,
  syncRequest: 0x30,
  syncAck: 0x31,
  setBest: 0x32,
} as const;

export const MessageType = {
  record: 0x01,
  syncDone: 0x02,
  error: 0x7f,
} as const;

export const ErrorCode = {
  unknownOpcode: 1,
  badLength: 2,
  badValue: 3,
  busy: 4,
} as const;

/** Games the fidget runs and scores on its own. Ids 1-63 are reserved for these. */
export const BasicModeId = {
  freePlay: 1,
  spinCount: 2,
} as const;
export type BasicModeName = keyof typeof BasicModeId;

/** Placeholders until the FSR is measured in the built toy. See PROTOCOL.md. */
export const SHARED_DEFAULTS = {
  squeezeRawMin: 200,
  squeezeRawMax: 3500,
  squeezeOnLevel: 0.3,
  squeezeOffLevel: 0.15,
} as const;
