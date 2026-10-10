import { describe, expect, it } from 'vitest';
import vectors from '../vectors/v1.json';
import {
  bytesToHex,
  type Command,
  decodeCommand,
  decodeDeviceInfo,
  decodeInputPacket,
  decodeMessage,
  type DeviceInfo,
  encodeCommand,
  encodeDeviceInfo,
  encodeInputPacket,
  encodeMessage,
  type FidgetMessage,
  hexToBytes,
  type InputPacket,
  PROTOCOL_VERSION,
  ProtocolError,
} from './index';

describe('golden vectors', () => {
  it('match this protocol version', () => {
    expect(vectors.protocolVersion).toBe(PROTOCOL_VERSION);
  });

  for (const v of vectors.input) {
    it(`input packet: ${v.name}`, () => {
      expect(decodeInputPacket(hexToBytes(v.hex))).toEqual(v.fields);
      expect(bytesToHex(encodeInputPacket(v.fields as InputPacket))).toBe(v.hex);
    });
  }

  for (const v of vectors.info) {
    it(`device info: ${v.name}`, () => {
      expect(decodeDeviceInfo(hexToBytes(v.hex))).toEqual(v.fields);
      expect(bytesToHex(encodeDeviceInfo(v.fields as DeviceInfo))).toBe(v.hex);
    });
  }

  for (const v of vectors.message) {
    it(`message: ${v.name}`, () => {
      expect(decodeMessage(hexToBytes(v.hex))).toEqual(v.fields);
      expect(bytesToHex(encodeMessage(v.fields as FidgetMessage))).toBe(v.hex);
    });
  }

  for (const v of vectors.command) {
    it(`command: ${v.name}`, () => {
      expect(decodeCommand(hexToBytes(v.hex))).toEqual(v.fields);
      expect(bytesToHex(encodeCommand(v.fields as Command))).toBe(v.hex);
    });
  }
});

describe('validation', () => {
  it('rejects a short input packet', () => {
    expect(() => decodeInputPacket(new Uint8Array(17))).toThrow(ProtocolError);
  });

  it('rejects unknown opcodes and trailing bytes', () => {
    expect(() => decodeCommand(Uint8Array.of(0x99))).toThrow(/unknown command/);
    expect(() => decodeCommand(Uint8Array.of(0x23, 0x00))).toThrow(ProtocolError);
    expect(() => decodeMessage(Uint8Array.of(0x55))).toThrow(/unknown message/);
  });

  it('rejects out-of-range command fields', () => {
    expect(() => encodeCommand({ type: 'haptic', effects: [] })).toThrow(ProtocolError);
    expect(() => encodeCommand({ type: 'haptic', effects: [1, 1, 1, 1, 1, 1, 1, 1, 1] })).toThrow(ProtocolError);
    expect(() => encodeCommand({ type: 'haptic', effects: [124] })).toThrow(ProtocolError);
    expect(() => encodeCommand({ type: 'showText', line: 4, text: 'x' })).toThrow(ProtocolError);
    expect(() => encodeCommand({ type: 'showScore', score: -1, best: 0, stars: 0 })).toThrow(ProtocolError);
    expect(() => encodeCommand({ type: 'setMode', mode: 7 })).toThrow(ProtocolError);
  });

  it('sanitizes and truncates display text to fit one payload', () => {
    const bytes = encodeCommand({ type: 'showText', line: 0, text: 'Great job, Jimmy! 🎉 keep going' });
    expect(bytes.byteLength).toBe(20);
    expect(decodeCommand(bytes)).toEqual({ type: 'showText', line: 0, text: 'Great job, Jimmy! ' });
    expect(decodeCommand(encodeCommand({ type: 'showText', line: 0, text: 'é🎉' }))).toEqual({
      type: 'showText',
      line: 0,
      text: '??',
    });
  });
});
