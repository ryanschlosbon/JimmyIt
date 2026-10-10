// JimmyIt fidget BLE protocol v1, firmware side.
// Spec: packages/protocol/PROTOCOL.md. Must match packages/protocol/src and
// packages/protocol/vectors/v1.json (checked by firmware/test).
//
// Field names are identical to the spec and the TypeScript codec on purpose.
// Both targets (nRF52840, host test build) are little-endian, so the packed
// structs below are the wire bytes.
#pragma once

#include <stddef.h>
#include <stdint.h>

namespace jimmyit {

constexpr uint8_t kProtocolVersion = 1;
constexpr size_t kMaxPayloadBytes = 20;
constexpr size_t kMaxTextLength = 18;
constexpr size_t kMaxHapticEffects = 8;
constexpr uint8_t kMaxHapticEffectId = 123;
constexpr uint8_t kDisplayLineCount = 4;
constexpr uint8_t kMaxStars = 3;
constexpr int32_t kSpinnerCountsPerTurn = 4096;
constexpr uint8_t kBatteryUnknown = 255;

// UUIDs: 59e5XXXX-3be2-4d9c-9607-646ddb5d9770.
constexpr uint16_t kUuidService = 0x0001;
constexpr uint16_t kUuidInput = 0x0002;
constexpr uint16_t kUuidCommand = 0x0003;
constexpr uint16_t kUuidMessage = 0x0004;
constexpr uint16_t kUuidInfo = 0x0005;
// Fills `out` with the 128-bit UUID in the LSB-first byte order Bluefruit's
// BLEUuid(const uint8_t[16]) expects.
void makeUuid128(uint16_t shortId, uint8_t out[16]);
// The same UUIDs as static arrays. Bluefruit's BLEUuid keeps a pointer to the
// bytes, so they must live for the whole program; these are constant-initialized
// and safe to use in global constructors.
extern const uint8_t kUuid128Service[16];
extern const uint8_t kUuid128Input[16];
extern const uint8_t kUuid128Command[16];
extern const uint8_t kUuid128Message[16];
extern const uint8_t kUuid128Info[16];

// Bit indexes in InputPacket::switches / ::pressed.
namespace SwitchBit {
constexpr uint8_t kClicker = 0;
constexpr uint8_t kNavUp = 1;
constexpr uint8_t kNavDown = 2;
constexpr uint8_t kRocker = 3;
constexpr uint8_t kScrewHome = 4;
constexpr uint8_t kScrewOut = 5;
constexpr uint8_t kSliderLow = 6;
constexpr uint8_t kSliderHigh = 7;
constexpr uint8_t kStylusStowed = 8;
constexpr uint8_t kFlapButtoned = 9;
}  // namespace SwitchBit

namespace FidgetMode {
constexpr uint8_t kStandalone = 1;
constexpr uint8_t kApp = 2;
}  // namespace FidgetMode

// Masks.
namespace InputFlag {
constexpr uint8_t kClockSet = 0x01;
constexpr uint8_t kCharging = 0x02;
constexpr uint8_t kStandaloneGame = 0x04;
}  // namespace InputFlag

namespace RecordFlag {
constexpr uint8_t kClockSet = 0x01;
constexpr uint8_t kCompleted = 0x02;
constexpr uint8_t kNewBest = 0x04;
}  // namespace RecordFlag

namespace Capability {
constexpr uint16_t kHaptics = 0x01;
constexpr uint16_t kDisplay = 0x02;
constexpr uint16_t kScoreLog = 0x04;
constexpr uint16_t kStandaloneModes = 0x08;
}  // namespace Capability

namespace CommandOpcode {
constexpr uint8_t kSetTime = 0x01;
constexpr uint8_t kSetMode = 0x02;
constexpr uint8_t kHaptic = 0x10;
constexpr uint8_t kShowText = 0x20;
constexpr uint8_t kShowScore = 0x21;
constexpr uint8_t kShowProgress = 0x22;
constexpr uint8_t kClearDisplay = 0x23;
constexpr uint8_t kSyncRequest = 0x30;
constexpr uint8_t kSyncAck = 0x31;
constexpr uint8_t kSetBest = 0x32;
}  // namespace CommandOpcode

namespace MessageType {
constexpr uint8_t kRecord = 0x01;
constexpr uint8_t kSyncDone = 0x02;
constexpr uint8_t kError = 0x7f;
}  // namespace MessageType

namespace ErrorCode {
constexpr uint8_t kNone = 0;
constexpr uint8_t kUnknownOpcode = 1;
constexpr uint8_t kBadLength = 2;
constexpr uint8_t kBadValue = 3;
constexpr uint8_t kBusy = 4;
}  // namespace ErrorCode

namespace BasicModeId {
constexpr uint8_t kNone = 0;
constexpr uint8_t kFreePlay = 1;
constexpr uint8_t kSpinCount = 2;
}  // namespace BasicModeId

// Placeholders until the FSR is measured; PROTOCOL.md "Shared defaults".
constexpr uint16_t kSqueezeRawMin = 200;
constexpr uint16_t kSqueezeRawMax = 3500;
// squeezeOnLevel 0.30 and squeezeOffLevel 0.15 expressed as raw ADC values.
constexpr uint16_t kSqueezeRawOn = kSqueezeRawMin + (kSqueezeRawMax - kSqueezeRawMin) * 30 / 100;
constexpr uint16_t kSqueezeRawOff = kSqueezeRawMin + (kSqueezeRawMax - kSqueezeRawMin) * 15 / 100;

struct __attribute__((packed)) InputPacket {
  uint8_t seq;
  uint8_t mode;
  uint16_t switches;
  uint16_t pressed;
  int32_t spinnerTotal;
  int16_t screwTotal;
  uint16_t squeezeRaw;
  uint16_t timeMs;
  uint8_t batteryPercent;
  uint8_t flags;
};
static_assert(sizeof(InputPacket) == 18, "InputPacket must be 18 bytes");

struct __attribute__((packed)) DeviceInfo {
  uint8_t protocolVersion;
  uint8_t firmwareMajor;
  uint8_t firmwareMinor;
  uint8_t firmwarePatch;
  uint32_t deviceId;
  uint16_t capabilities;
  uint32_t newestRecordId;
  uint16_t storedRecordCount;
};
static_assert(sizeof(DeviceInfo) == 16, "DeviceInfo must be 16 bytes");

struct __attribute__((packed)) RecordMessage {
  uint8_t type;  // MessageType::kRecord
  uint32_t recordId;
  uint8_t modeId;
  uint8_t flags;
  uint32_t startUnix;
  uint16_t durationS;
  uint32_t score;
  uint16_t actions;
};
static_assert(sizeof(RecordMessage) == 19, "RecordMessage must be 19 bytes");

struct __attribute__((packed)) SyncDoneMessage {
  uint8_t type;  // MessageType::kSyncDone
  uint32_t newestRecordId;
  uint16_t sentCount;
};
static_assert(sizeof(SyncDoneMessage) == 7, "SyncDoneMessage must be 7 bytes");

struct __attribute__((packed)) ErrorMessage {
  uint8_t type;  // MessageType::kError
  uint8_t code;
  uint8_t opcode;
};
static_assert(sizeof(ErrorMessage) == 3, "ErrorMessage must be 3 bytes");

// One decoded command. Only the fields for `opcode` are meaningful; the rest
// stay zero. Text fields are NUL-terminated.
struct ParsedCommand {
  uint8_t opcode;
  uint32_t unixSeconds;               // setTime
  uint8_t mode;                       // setMode
  uint8_t effects[kMaxHapticEffects]; // haptic
  uint8_t effectCount;                // haptic
  uint8_t line;                       // showText
  char text[kMaxTextLength + 1];      // showText
  uint32_t score;                     // showScore, setBest
  uint32_t best;                      // showScore
  uint8_t stars;                      // showScore
  uint8_t percent;                    // showProgress
  char label[kMaxTextLength + 1];     // showProgress
  uint32_t afterRecordId;             // syncRequest
  uint32_t upToRecordId;              // syncAck
  uint8_t modeId;                     // setBest
};

// Parses one write to the command characteristic. Returns ErrorCode::kNone or
// the code to send back in an ErrorMessage.
uint8_t parseCommand(const uint8_t* data, size_t length, ParsedCommand& out);

ErrorMessage makeErrorMessage(uint8_t code, uint8_t opcode);

}  // namespace jimmyit
