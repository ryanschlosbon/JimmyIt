import { createByteReader, createByteWriter, ProtocolError } from './bytes';
import {
  CommandOpcode,
  DISPLAY_LINE_COUNT,
  FidgetMode,
  MAX_HAPTIC_EFFECT_ID,
  MAX_HAPTIC_EFFECTS,
  MAX_STARS,
  MAX_APP_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  ScoreEventKind,
} from './constants';

/** App → fidget command, wire-faithful. See PROTOCOL.md "command". */
export type Command =
  | { readonly type: 'setTime'; readonly unixSeconds: number }
  | { readonly type: 'setMode'; readonly mode: number }
  | { readonly type: 'hello'; readonly appId: number; readonly name: string }
  | { readonly type: 'haptic'; readonly effects: readonly number[] }
  | { readonly type: 'showText'; readonly line: number; readonly text: string }
  | { readonly type: 'showScore'; readonly score: number; readonly best: number; readonly stars: number }
  | { readonly type: 'showProgress'; readonly percent: number; readonly label: string }
  | { readonly type: 'clearDisplay' }
  | { readonly type: 'scoreEvent'; readonly kind: number; readonly score: number; readonly value: number }
  | { readonly type: 'syncRequest'; readonly afterRecordId: number }
  | { readonly type: 'syncAck'; readonly upToRecordId: number }
  | { readonly type: 'setBest'; readonly modeId: number; readonly score: number };

export type CommandType = Command['type'];

function checkRange(value: number, min: number, max: number, field: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ProtocolError(`${field} must be an integer in [${min}, ${max}], got ${value}`);
  }
}

function checkMode(mode: number): void {
  if (mode !== FidgetMode.standalone && mode !== FidgetMode.app) {
    throw new ProtocolError(`mode must be ${FidgetMode.standalone} or ${FidgetMode.app}, got ${mode}`);
  }
}

function checkEventKind(kind: number): void {
  if (!(Object.values(ScoreEventKind) as number[]).includes(kind)) {
    throw new ProtocolError(`unknown score event kind ${kind}`);
  }
}

function checkEffects(effects: readonly number[]): void {
  if (effects.length < 1 || effects.length > MAX_HAPTIC_EFFECTS) {
    throw new ProtocolError(`haptic needs 1-${MAX_HAPTIC_EFFECTS} effects, got ${effects.length}`);
  }
  for (const effect of effects) checkRange(effect, 1, MAX_HAPTIC_EFFECT_ID, 'effect');
}

export function encodeCommand(command: Command): Uint8Array {
  const w = createByteWriter().u8(CommandOpcode[command.type], 'opcode');
  switch (command.type) {
    case 'setTime':
      return w.u32(command.unixSeconds, 'unixSeconds').finish();
    case 'setMode':
      checkMode(command.mode);
      return w.u8(command.mode, 'mode').finish();
    case 'hello':
      return w.u32(command.appId, 'appId').ascii(command.name, MAX_APP_NAME_LENGTH).finish();
    case 'haptic':
      checkEffects(command.effects);
      for (const effect of command.effects) w.u8(effect, 'effect');
      return w.finish();
    case 'showText':
      checkRange(command.line, 0, DISPLAY_LINE_COUNT - 1, 'line');
      return w.u8(command.line, 'line').ascii(command.text, MAX_TEXT_LENGTH).finish();
    case 'showScore':
      checkRange(command.stars, 0, MAX_STARS, 'stars');
      return w.u32(command.score, 'score').u32(command.best, 'best').u8(command.stars, 'stars').finish();
    case 'showProgress':
      checkRange(command.percent, 0, 100, 'percent');
      return w.u8(command.percent, 'percent').ascii(command.label, MAX_TEXT_LENGTH).finish();
    case 'clearDisplay':
      return w.finish();
    case 'scoreEvent':
      checkEventKind(command.kind);
      return w.u8(command.kind, 'kind').u32(command.score, 'score').u32(command.value, 'value').finish();
    case 'syncRequest':
      return w.u32(command.afterRecordId, 'afterRecordId').finish();
    case 'syncAck':
      return w.u32(command.upToRecordId, 'upToRecordId').finish();
    case 'setBest':
      return w.u8(command.modeId, 'modeId').u32(command.score, 'score').finish();
  }
}

/** Used by the fake fidget and tests; the firmware has its own C++ parser. */
export function decodeCommand(bytes: Uint8Array): Command {
  const r = createByteReader(bytes, 'command');
  const opcode = r.u8();
  let command: Command;
  switch (opcode) {
    case CommandOpcode.setTime:
      command = { type: 'setTime', unixSeconds: r.u32() };
      break;
    case CommandOpcode.setMode:
      command = { type: 'setMode', mode: r.u8() };
      checkMode(command.mode);
      break;
    case CommandOpcode.hello: {
      const appId = r.u32();
      if (r.remaining() > MAX_APP_NAME_LENGTH) throw new ProtocolError('hello: name too long');
      command = { type: 'hello', appId, name: r.restAscii() };
      break;
    }
    case CommandOpcode.haptic: {
      const effects: number[] = [];
      while (r.remaining() > 0) effects.push(r.u8());
      checkEffects(effects);
      command = { type: 'haptic', effects };
      break;
    }
    case CommandOpcode.showText: {
      const line = r.u8();
      checkRange(line, 0, DISPLAY_LINE_COUNT - 1, 'line');
      if (r.remaining() > MAX_TEXT_LENGTH) throw new ProtocolError('showText: text too long');
      command = { type: 'showText', line, text: r.restAscii() };
      break;
    }
    case CommandOpcode.showScore:
      command = { type: 'showScore', score: r.u32(), best: r.u32(), stars: r.u8() };
      checkRange(command.stars, 0, MAX_STARS, 'stars');
      break;
    case CommandOpcode.showProgress: {
      const percent = r.u8();
      checkRange(percent, 0, 100, 'percent');
      if (r.remaining() > MAX_TEXT_LENGTH) throw new ProtocolError('showProgress: label too long');
      command = { type: 'showProgress', percent, label: r.restAscii() };
      break;
    }
    case CommandOpcode.clearDisplay:
      command = { type: 'clearDisplay' };
      break;
    case CommandOpcode.scoreEvent:
      command = { type: 'scoreEvent', kind: r.u8(), score: r.u32(), value: r.u32() };
      checkEventKind(command.kind);
      break;
    case CommandOpcode.syncRequest:
      command = { type: 'syncRequest', afterRecordId: r.u32() };
      break;
    case CommandOpcode.syncAck:
      command = { type: 'syncAck', upToRecordId: r.u32() };
      break;
    case CommandOpcode.setBest:
      command = { type: 'setBest', modeId: r.u8(), score: r.u32() };
      break;
    default:
      throw new ProtocolError(`unknown command opcode 0x${opcode.toString(16)}`);
  }
  r.expectEnd();
  return command;
}
