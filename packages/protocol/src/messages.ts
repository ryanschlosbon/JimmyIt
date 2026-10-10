import { createByteReader, createByteWriter, ProtocolError } from './bytes';
import { ApprovalStatus, MessageType } from './constants';

/** Fidget → app message, wire-faithful. See PROTOCOL.md "message". */
export type FidgetMessage =
  | {
      readonly type: 'record';
      readonly recordId: number;
      readonly modeId: number;
      readonly flags: number;
      readonly startUnix: number;
      readonly durationS: number;
      readonly score: number;
      readonly actions: number;
    }
  | { readonly type: 'syncDone'; readonly newestRecordId: number; readonly sentCount: number }
  | {
      readonly type: 'scoreEvent';
      readonly kind: number;
      readonly modeId: number;
      readonly score: number;
      readonly value: number;
    }
  | { readonly type: 'approval'; readonly status: number }
  | { readonly type: 'error'; readonly code: number; readonly opcode: number };

export type RecordMessage = Extract<FidgetMessage, { type: 'record' }>;
export type ScoreEventMessage = Extract<FidgetMessage, { type: 'scoreEvent' }>;

export function decodeMessage(bytes: Uint8Array): FidgetMessage {
  const r = createByteReader(bytes, 'message');
  const type = r.u8();
  let message: FidgetMessage;
  switch (type) {
    case MessageType.record:
      message = {
        type: 'record',
        recordId: r.u32(),
        modeId: r.u8(),
        flags: r.u8(),
        startUnix: r.u32(),
        durationS: r.u16(),
        score: r.u32(),
        actions: r.u16(),
      };
      break;
    case MessageType.syncDone:
      message = { type: 'syncDone', newestRecordId: r.u32(), sentCount: r.u16() };
      break;
    case MessageType.scoreEvent:
      message = { type: 'scoreEvent', kind: r.u8(), modeId: r.u8(), score: r.u32(), value: r.u32() };
      break;
    case MessageType.approval:
      message = { type: 'approval', status: r.u8() };
      if (!(Object.values(ApprovalStatus) as number[]).includes(message.status)) {
        throw new ProtocolError(`unknown approval status ${message.status}`);
      }
      break;
    case MessageType.error:
      message = { type: 'error', code: r.u8(), opcode: r.u8() };
      break;
    default:
      throw new ProtocolError(`unknown message type 0x${type.toString(16)}`);
  }
  r.expectEnd();
  return message;
}

/** Used by the fake fidget and tests; the firmware encodes with C++ structs. */
export function encodeMessage(message: FidgetMessage): Uint8Array {
  const w = createByteWriter().u8(MessageType[message.type], 'type');
  switch (message.type) {
    case 'record':
      return w
        .u32(message.recordId, 'recordId')
        .u8(message.modeId, 'modeId')
        .u8(message.flags, 'flags')
        .u32(message.startUnix, 'startUnix')
        .u16(message.durationS, 'durationS')
        .u32(message.score, 'score')
        .u16(message.actions, 'actions')
        .finish();
    case 'syncDone':
      return w.u32(message.newestRecordId, 'newestRecordId').u16(message.sentCount, 'sentCount').finish();
    case 'scoreEvent':
      return w
        .u8(message.kind, 'kind')
        .u8(message.modeId, 'modeId')
        .u32(message.score, 'score')
        .u32(message.value, 'value')
        .finish();
    case 'approval':
      return w.u8(message.status, 'status').finish();
    case 'error':
      return w.u8(message.code, 'code').u8(message.opcode, 'opcode').finish();
  }
}
