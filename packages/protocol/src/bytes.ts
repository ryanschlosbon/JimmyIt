import { MAX_PAYLOAD_BYTES } from './constants';

export class ProtocolError extends Error {
  override name = 'ProtocolError';
}

export interface ByteWriter {
  u8(value: number, field: string): ByteWriter;
  u16(value: number, field: string): ByteWriter;
  i16(value: number, field: string): ByteWriter;
  u32(value: number, field: string): ByteWriter;
  i32(value: number, field: string): ByteWriter;
  /** Writes sanitized ASCII with no terminator. */
  ascii(text: string, maxLength: number): ByteWriter;
  finish(): Uint8Array;
}

export interface ByteReader {
  u8(): number;
  u16(): number;
  i16(): number;
  u32(): number;
  i32(): number;
  /** Reads every remaining byte as ASCII. */
  restAscii(): string;
  remaining(): number;
  expectEnd(): void;
}

function checkInteger(value: number, min: number, max: number, field: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ProtocolError(`${field} must be an integer in [${min}, ${max}], got ${value}`);
  }
}

/** Replaces anything outside printable ASCII with '?' and truncates. */
export function sanitizeAscii(text: string, maxLength: number): string {
  let out = '';
  for (const char of text) {
    if (out.length >= maxLength) break;
    const code = char.charCodeAt(0);
    out += char.length === 1 && code >= 0x20 && code <= 0x7e ? char : '?';
  }
  return out;
}

export function createByteWriter(): ByteWriter {
  const bytes: number[] = [];
  const writer: ByteWriter = {
    u8(value, field) {
      checkInteger(value, 0, 0xff, field);
      bytes.push(value);
      return writer;
    },
    u16(value, field) {
      checkInteger(value, 0, 0xffff, field);
      bytes.push(value & 0xff, (value >>> 8) & 0xff);
      return writer;
    },
    i16(value, field) {
      checkInteger(value, -0x8000, 0x7fff, field);
      const raw = value & 0xffff;
      bytes.push(raw & 0xff, (raw >>> 8) & 0xff);
      return writer;
    },
    u32(value, field) {
      checkInteger(value, 0, 0xffffffff, field);
      bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
      return writer;
    },
    i32(value, field) {
      checkInteger(value, -0x80000000, 0x7fffffff, field);
      const raw = value >>> 0;
      bytes.push(raw & 0xff, (raw >>> 8) & 0xff, (raw >>> 16) & 0xff, (raw >>> 24) & 0xff);
      return writer;
    },
    ascii(text, maxLength) {
      for (const char of sanitizeAscii(text, maxLength)) bytes.push(char.charCodeAt(0));
      return writer;
    },
    finish() {
      if (bytes.length > MAX_PAYLOAD_BYTES) {
        throw new ProtocolError(`payload is ${bytes.length} bytes; the limit is ${MAX_PAYLOAD_BYTES}`);
      }
      return Uint8Array.from(bytes);
    },
  };
  return writer;
}

export function createByteReader(bytes: Uint8Array, what: string): ByteReader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  function take(size: number): number {
    if (offset + size > bytes.byteLength) {
      throw new ProtocolError(`${what}: payload is ${bytes.byteLength} bytes, too short`);
    }
    const at = offset;
    offset += size;
    return at;
  }

  return {
    u8: () => view.getUint8(take(1)),
    u16: () => view.getUint16(take(2), true),
    i16: () => view.getInt16(take(2), true),
    u32: () => view.getUint32(take(4), true),
    i32: () => view.getInt32(take(4), true),
    restAscii() {
      let text = '';
      while (offset < bytes.byteLength) text += String.fromCharCode(view.getUint8(offset++));
      return text;
    },
    remaining: () => bytes.byteLength - offset,
    expectEnd() {
      if (offset !== bytes.byteLength) {
        throw new ProtocolError(`${what}: payload is ${bytes.byteLength} bytes, expected ${offset}`);
      }
    },
  };
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) {
    throw new ProtocolError(`not a hex string: ${hex}`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}
