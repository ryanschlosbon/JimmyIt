import { createByteReader, createByteWriter, ProtocolError } from './bytes';
import { INPUT_PACKET_BYTES } from './constants';

/** One `input` notification, exactly as it is on the wire. See PROTOCOL.md. */
export interface InputPacket {
  readonly seq: number;
  readonly mode: number;
  readonly switches: number;
  readonly pressed: number;
  readonly spinnerTotal: number;
  readonly screwTotal: number;
  readonly squeezeRaw: number;
  readonly timeMs: number;
  readonly batteryPercent: number;
  readonly flags: number;
}

export function decodeInputPacket(bytes: Uint8Array): InputPacket {
  if (bytes.byteLength !== INPUT_PACKET_BYTES) {
    throw new ProtocolError(`input packet: payload is ${bytes.byteLength} bytes, expected ${INPUT_PACKET_BYTES}`);
  }
  const r = createByteReader(bytes, 'input packet');
  return {
    seq: r.u8(),
    mode: r.u8(),
    switches: r.u16(),
    pressed: r.u16(),
    spinnerTotal: r.i32(),
    screwTotal: r.i16(),
    squeezeRaw: r.u16(),
    timeMs: r.u16(),
    batteryPercent: r.u8(),
    flags: r.u8(),
  };
}

export function encodeInputPacket(packet: InputPacket): Uint8Array {
  return createByteWriter()
    .u8(packet.seq, 'seq')
    .u8(packet.mode, 'mode')
    .u16(packet.switches, 'switches')
    .u16(packet.pressed, 'pressed')
    .i32(packet.spinnerTotal, 'spinnerTotal')
    .i16(packet.screwTotal, 'screwTotal')
    .u16(packet.squeezeRaw, 'squeezeRaw')
    .u16(packet.timeMs, 'timeMs')
    .u8(packet.batteryPercent, 'batteryPercent')
    .u8(packet.flags, 'flags')
    .finish();
}
