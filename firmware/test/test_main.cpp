// Host-side tests for the portable firmware modules. Build and run: `make -C firmware/test`.
#include <stdio.h>
#include <string.h>

#include "basic_modes.h"
#include "fidget_protocol.h"
#include "input_helpers.h"
#include "score_log.h"

static int failures = 0;
#define CHECK_MSG(cond, msg)                                         \
  do {                                                               \
    if (!(cond)) {                                                   \
      failures++;                                                    \
      fprintf(stderr, "FAIL %s:%d %s (%s)\n", __FILE__, __LINE__, msg, #cond); \
    }                                                                \
  } while (0)
#define CHECK(cond) CHECK_MSG(cond, "")

#include "vectors.generated.h"

using namespace jimmyit;

static void testUuid() {
  uint8_t uuid[16];
  makeUuid128(kUuidInput, uuid);
  // 59e50002-3be2-4d9c-9607-646ddb5d9770, LSB first.
  const uint8_t expected[16] = {0x70, 0x97, 0x5d, 0xdb, 0x6d, 0x64, 0x07, 0x96, 0x9c, 0x4d, 0xe2, 0x3b, 0x02, 0x00, 0xe5, 0x59};
  CHECK(memcmp(uuid, expected, 16) == 0);
  CHECK(memcmp(kUuid128Input, expected, 16) == 0);
  const uint8_t* arrays[] = {kUuid128Service, kUuid128Input, kUuid128Command, kUuid128Message, kUuid128Info};
  const uint16_t ids[] = {kUuidService, kUuidInput, kUuidCommand, kUuidMessage, kUuidInfo};
  for (int i = 0; i < 5; i++) {
    makeUuid128(ids[i], uuid);
    CHECK(memcmp(uuid, arrays[i], 16) == 0);
  }
}

static void testDebouncer() {
  SwitchDebouncer d(50);
  CHECK(d.update(0x0000, 0) == 0);        // baseline
  CHECK(d.update(0x0001, 10) == 0);       // closed, settling
  CHECK(d.update(0x0000, 20) == 0);       // bounce open
  CHECK(d.update(0x0001, 30) == 0);       // closed again: timer restarts at 30
  CHECK(d.update(0x0001, 79) == 0);
  CHECK(d.update(0x0001, 80) == 0x0001);  // stable for 50 ms: one press
  CHECK(d.update(0x0001, 500) == 0);      // held: no repeat
  CHECK(d.update(0x0000, 510) == 0);
  CHECK(d.update(0x0000, 560) == 0);      // release is reported via stable(), not as a press
  CHECK(d.stable() == 0);
  CHECK(d.update(0x0300, 600) == 0);
  CHECK(d.update(0x0300, 650) == 0x0300); // two switches at once
  SwitchDebouncer heldAtBoot(50);
  CHECK(heldAtBoot.update(0x0004, 0) == 0 && heldAtBoot.stable() == 0x0004);
}

static void testSpinnerTracker() {
  SpinnerTracker s;
  CHECK(s.update(4000) == 0);   // baseline
  CHECK(s.update(100) == 196);  // forward across the 4095 -> 0 wrap
  CHECK(s.update(4090) == 90);  // backward 106 across the wrap
  CHECK(s.update(2042) == -1958); // exactly half a turn counts as backward
}

static void testQuadrature() {
  QuadratureDecoder q;
  q.begin(true, true);
  // 11 -> 10 -> 00 -> 01 -> 11 is one detent in the negative direction.
  const bool cycle[4][2] = {{true, false}, {false, false}, {false, true}, {true, true}};
  for (int turn = 0; turn < 3; turn++) {
    for (const auto& s : cycle) q.onEdge(s[0], s[1]);
  }
  CHECK(q.quarterSteps() == -12 && q.detents() == -3);
  q.onEdge(false, true);  // reverse one quarter
  q.onEdge(false, false); // reverse two quarters: halfway between detents
  CHECK(q.quarterSteps() == -10 && q.detents() == -3);
  q.onEdge(true, false);
  q.onEdge(true, true);   // rest position one detent back
  CHECK(q.quarterSteps() == -8 && q.detents() == -2);
  q.onEdge(false, false); // invalid double jump: ignored
  CHECK(q.quarterSteps() == -8);
}

static void testCommandErrors() {
  ParsedCommand c;
  const uint8_t unknown[] = {0x99};
  CHECK(parseCommand(unknown, sizeof(unknown), c) == ErrorCode::kUnknownOpcode);
  const uint8_t shortTime[] = {CommandOpcode::kSetTime, 1, 2};
  CHECK(parseCommand(shortTime, sizeof(shortTime), c) == ErrorCode::kBadLength);
  const uint8_t badMode[] = {CommandOpcode::kSetMode, 9};
  CHECK(parseCommand(badMode, sizeof(badMode), c) == ErrorCode::kBadValue);
  const uint8_t badEffect[] = {CommandOpcode::kHaptic, 0};
  CHECK(parseCommand(badEffect, sizeof(badEffect), c) == ErrorCode::kBadValue);
  const uint8_t badLine[] = {CommandOpcode::kShowText, 4, 'h', 'i'};
  CHECK(parseCommand(badLine, sizeof(badLine), c) == ErrorCode::kBadValue);
  const uint8_t controlChar[] = {CommandOpcode::kShowText, 0, 'a', 0x07, 'b'};
  CHECK(parseCommand(controlChar, sizeof(controlChar), c) == ErrorCode::kNone);
  CHECK(strcmp(c.text, "a?b") == 0);
  CHECK(parseCommand(unknown, 0, c) == ErrorCode::kBadLength);
}

static ScoreEntry entry(uint8_t modeId, uint32_t score) {
  ScoreEntry e = {};
  e.modeId = modeId;
  e.score = score;
  e.durationS = 30;
  return e;
}

static void testScoreLog() {
  static ScoreLog log;  // static: too big for some embedded stacks, keep the habit here
  log.clear();
  CHECK(log.newestRecordId() == 0);
  CHECK(log.add(entry(1, 10)) == 1);
  CHECK(log.add(entry(2, 20)) == 2);
  CHECK(log.add(entry(1, 30)) == 3);

  ScoreEntry out[ScoreLog::kCapacity];
  CHECK(log.collectAfter(1, out, ScoreLog::kCapacity) == 2);
  CHECK(out[0].recordId == 2 && out[1].recordId == 3);
  CHECK(log.unsyncedCount() == 3);
  log.ack(2);
  CHECK(log.unsyncedCount() == 1);
  log.ack(99);  // beyond newest: ignored
  CHECK(log.ackedRecordId() == 2);

  log.raiseBest(2, 50);
  log.raiseBest(2, 40);
  CHECK(log.best(2) == 50);

  // Ring overwrite keeps the newest kCapacity entries and ids keep counting.
  for (int i = 0; i < 70; i++) log.add(entry(1, static_cast<uint32_t>(i)));
  CHECK(log.count() == ScoreLog::kCapacity);
  CHECK(log.newestRecordId() == 73);
  CHECK(log.collectAfter(0, out, ScoreLog::kCapacity) == ScoreLog::kCapacity);
  CHECK(out[0].recordId == 10 && out[ScoreLog::kCapacity - 1].recordId == 73);

  static uint8_t saved[ScoreLog::kSerializedBytes];
  log.serialize(saved);
  static ScoreLog restored;
  CHECK(restored.deserialize(saved, sizeof(saved)));
  CHECK(restored.newestRecordId() == 73 && restored.ackedRecordId() == 2 && restored.best(2) == 50);
  CHECK(restored.collectAfter(72, out, ScoreLog::kCapacity) == 1 && out[0].score == 69);
  saved[0] = 0xee;
  CHECK(!restored.deserialize(saved, sizeof(saved)));
  CHECK(restored.count() == 0);

  const RecordMessage message = toRecordMessage(out[0]);
  CHECK(message.type == MessageType::kRecord && message.recordId == 73);
}

static InputPacket idle() {
  InputPacket p = {};
  p.mode = FidgetMode::kStandalone;
  p.squeezeRaw = kSqueezeRawMin;
  return p;
}

static void testSpinCount() {
  BasicGame game;
  CHECK(game.start(BasicModeId::kSpinCount, 1000, 0, false));
  InputPacket p = idle();
  game.update(p, 1000);  // baseline
  p.spinnerTotal = kSpinnerCountsPerTurn * 2 + 100;
  game.update(p, 5000);
  p.spinnerTotal = -kSpinnerCountsPerTurn;  // reverse: 3 more turns of travel, minus nothing
  game.update(p, 10000);
  CHECK(game.score() == 50);
  CHECK(game.remainingMs(10000) == 21000);
  game.update(p, 31000);
  CHECK(game.isFinished());
  const ScoreEntry result = game.result(40);
  CHECK(result.durationS == 30);
  CHECK(result.flags == (RecordFlag::kCompleted | RecordFlag::kNewBest));
}

static void testFreePlay() {
  BasicGame game;
  CHECK(game.start(BasicModeId::kFreePlay, 0, 1760000000, true));
  InputPacket p = idle();
  game.update(p, 0);
  p.pressed = (1 << SwitchBit::kClicker) | (1 << SwitchBit::kNavUp);  // 2
  p.screwTotal = -3;                                                  // 3
  p.spinnerTotal = kSpinnerCountsPerTurn / 4;                         // 2 eighths
  p.squeezeRaw = kSqueezeRawOn;                                       // 1
  game.update(p, 1000);
  CHECK(game.score() == 80);
  p.pressed = 0;
  game.update(p, 20999);
  CHECK(game.isRunning());
  game.update(p, 21000);  // 20 s idle
  CHECK(game.isFinished());
  const ScoreEntry result = game.result(100);
  CHECK(result.flags == (RecordFlag::kClockSet | RecordFlag::kCompleted));
  CHECK(result.startUnix == 1760000000 && result.actions == 8 && result.durationS == 21);

  CHECK(!game.start(99, 0, 0, false));
  CHECK(game.start(BasicModeId::kFreePlay, 0, 0, false));
  game.cancel(500);
  CHECK((game.result(0).flags & RecordFlag::kCompleted) == 0);
}

int main() {
  runVectorTests();
  testUuid();
  testDebouncer();
  testSpinnerTracker();
  testQuadrature();
  testCommandErrors();
  testScoreLog();
  testSpinCount();
  testFreePlay();
  if (failures) {
    fprintf(stderr, "%d check(s) failed\n", failures);
    return 1;
  }
  printf("firmware host tests passed\n");
  return 0;
}
