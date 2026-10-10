#include "fidget_protocol.h"

#include <string.h>

namespace jimmyit {

namespace {

// 59e5XXXX-3be2-4d9c-9607-646ddb5d9770, LSB first; bytes 12-13 are XXXX.
constexpr uint8_t kUuidBaseLsbFirst[16] = {0x70, 0x97, 0x5d, 0xdb, 0x6d, 0x64, 0x07, 0x96,
                                           0x9c, 0x4d, 0xe2, 0x3b, 0x00, 0x00, 0xe5, 0x59};

uint32_t readU32(const uint8_t* p) {
  return static_cast<uint32_t>(p[0]) | (static_cast<uint32_t>(p[1]) << 8) | (static_cast<uint32_t>(p[2]) << 16) |
         (static_cast<uint32_t>(p[3]) << 24);
}

bool copyText(const uint8_t* data, size_t length, char* out) {
  if (length > kMaxTextLength) return false;
  for (size_t i = 0; i < length; i++) {
    out[i] = (data[i] >= 0x20 && data[i] <= 0x7e) ? static_cast<char>(data[i]) : '?';
  }
  out[length] = '\0';
  return true;
}

}  // namespace

void makeUuid128(uint16_t shortId, uint8_t out[16]) {
  memcpy(out, kUuidBaseLsbFirst, 16);
  out[12] = static_cast<uint8_t>(shortId & 0xff);
  out[13] = static_cast<uint8_t>(shortId >> 8);
}

ErrorMessage makeErrorMessage(uint8_t code, uint8_t opcode) {
  ErrorMessage message;
  message.type = MessageType::kError;
  message.code = code;
  message.opcode = opcode;
  return message;
}

uint8_t parseCommand(const uint8_t* data, size_t length, ParsedCommand& out) {
  memset(&out, 0, sizeof(out));
  if (length == 0 || length > kMaxPayloadBytes) return ErrorCode::kBadLength;
  out.opcode = data[0];
  const uint8_t* p = data + 1;
  const size_t n = length - 1;

  switch (out.opcode) {
    case CommandOpcode::kSetTime:
      if (n != 4) return ErrorCode::kBadLength;
      out.unixSeconds = readU32(p);
      return ErrorCode::kNone;

    case CommandOpcode::kSetMode:
      if (n != 1) return ErrorCode::kBadLength;
      out.mode = p[0];
      if (out.mode != FidgetMode::kStandalone && out.mode != FidgetMode::kApp) return ErrorCode::kBadValue;
      return ErrorCode::kNone;

    case CommandOpcode::kHaptic:
      if (n < 1 || n > kMaxHapticEffects) return ErrorCode::kBadLength;
      for (size_t i = 0; i < n; i++) {
        if (p[i] < 1 || p[i] > kMaxHapticEffectId) return ErrorCode::kBadValue;
        out.effects[i] = p[i];
      }
      out.effectCount = static_cast<uint8_t>(n);
      return ErrorCode::kNone;

    case CommandOpcode::kShowText:
      if (n < 1) return ErrorCode::kBadLength;
      out.line = p[0];
      if (out.line >= kDisplayLineCount) return ErrorCode::kBadValue;
      return copyText(p + 1, n - 1, out.text) ? ErrorCode::kNone : ErrorCode::kBadLength;

    case CommandOpcode::kShowScore:
      if (n != 9) return ErrorCode::kBadLength;
      out.score = readU32(p);
      out.best = readU32(p + 4);
      out.stars = p[8];
      return out.stars <= kMaxStars ? ErrorCode::kNone : ErrorCode::kBadValue;

    case CommandOpcode::kShowProgress:
      if (n < 1) return ErrorCode::kBadLength;
      out.percent = p[0];
      if (out.percent > 100) return ErrorCode::kBadValue;
      return copyText(p + 1, n - 1, out.label) ? ErrorCode::kNone : ErrorCode::kBadLength;

    case CommandOpcode::kClearDisplay:
      return n == 0 ? ErrorCode::kNone : ErrorCode::kBadLength;

    case CommandOpcode::kSyncRequest:
      if (n != 4) return ErrorCode::kBadLength;
      out.afterRecordId = readU32(p);
      return ErrorCode::kNone;

    case CommandOpcode::kSyncAck:
      if (n != 4) return ErrorCode::kBadLength;
      out.upToRecordId = readU32(p);
      return ErrorCode::kNone;

    case CommandOpcode::kSetBest:
      if (n != 5) return ErrorCode::kBadLength;
      out.modeId = p[0];
      out.score = readU32(p + 1);
      return ErrorCode::kNone;

    default:
      return ErrorCode::kUnknownOpcode;
  }
}

}  // namespace jimmyit
