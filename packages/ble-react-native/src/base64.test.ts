import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64', () => {
  it('matches known encodings for every padding length', () => {
    expect(bytesToBase64(Uint8Array.of())).toBe('');
    expect(bytesToBase64(Uint8Array.of(0x66))).toBe('Zg==');
    expect(bytesToBase64(Uint8Array.of(0x66, 0x6f))).toBe('Zm8=');
    expect(bytesToBase64(Uint8Array.of(0x66, 0x6f, 0x6f))).toBe('Zm9v');
    expect(bytesToBase64(Uint8Array.of(0xff, 0xfe, 0x00, 0x01))).toBe('//4AAQ==');
  });

  it('round-trips every byte value', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    for (let n = 0; n <= 20; n++) expect(base64ToBytes(bytesToBase64(all.slice(0, n)))).toEqual(all.slice(0, n));
    expect(base64ToBytes(bytesToBase64(all))).toEqual(all);
  });

  it('rejects junk', () => {
    expect(() => base64ToBytes('ab$c')).toThrow();
  });
});
