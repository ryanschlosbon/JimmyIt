// Host-side tests for the portable firmware modules. Build and run: `make -C firmware/test`.
#include <stdio.h>
#include <string.h>

#include "basic_modes.h"
#include "battery_level.h"
#include "celebration.h"
#include "connection_approval.h"
#include "fidget_protocol.h"
#include "input_helpers.h"
#include "score_log.h"
#include "score_events.h"

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
  const uint32_t extra = 6;
  for (uint32_t i = 0; i < ScoreLog::kCapacity + extra; i++) log.add(entry(1, i));
  const uint32_t newest = 3 + ScoreLog::kCapacity + extra;
  CHECK(log.count() == ScoreLog::kCapacity);
  CHECK(log.newestRecordId() == newest);
  CHECK(log.collectAfter(0, out, ScoreLog::kCapacity) == ScoreLog::kCapacity);
  CHECK(out[0].recordId == newest - ScoreLog::kCapacity + 1 && out[ScoreLog::kCapacity - 1].recordId == newest);

  static uint8_t saved[ScoreLog::kSerializedBytes];
  log.serialize(saved);
  static ScoreLog restored;
  CHECK(restored.deserialize(saved, sizeof(saved)));
  CHECK(restored.newestRecordId() == newest && restored.ackedRecordId() == 2 && restored.best(2) == 50);
  CHECK(restored.collectAfter(newest - 1, out, ScoreLog::kCapacity) == 1 && out[0].score == ScoreLog::kCapacity + extra - 1);
  saved[0] = 0xee;
  CHECK(!restored.deserialize(saved, sizeof(saved)));
  CHECK(restored.count() == 0);

  const RecordMessage message = toRecordMessage(out[0]);
  CHECK(message.type == MessageType::kRecord && message.recordId == newest);
}

static InputPacket idle() {
  InputPacket p = {};
  p.mode = FidgetMode::kStandalone;
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
  p.pressed = (1 << SwitchBit::kClicker) | (1 << SwitchBit::kNavLeft);  // 2
  p.screwTotal = -3;                                                  // 3
  p.spinnerTotal = kSpinnerCountsPerTurn / 4;                         // 1 (a 90° spin)
  game.update(p, 1000);
  CHECK(game.score() == 60);
  p.pressed = 0;
  game.update(p, 20999);
  CHECK(game.isRunning());
  game.update(p, 21000);  // 20 s idle
  CHECK(game.isFinished());
  const ScoreEntry result = game.result(100);
  CHECK(result.flags == (RecordFlag::kClockSet | RecordFlag::kCompleted));
  CHECK(result.startUnix == 1760000000 && result.actions == 6 && result.durationS == 21);

  CHECK(!game.start(99, 0, 0, false));
  CHECK(game.start(BasicModeId::kFreePlay, 0, 0, false));
  game.cancel(500);
  CHECK((game.result(0).flags & RecordFlag::kCompleted) == 0);
}

// The default game: the first move starts it (and scores), and it ends when
// the child takes too long for the next move.
static void testFreePlayStartsOnFirstMove() {
  BasicGame game;
  CHECK(game.arm(BasicModeId::kFreePlay, 0, 100, false));
  InputPacket p = idle();
  game.update(p, 0);  // baseline
  game.update(p, 5000);
  CHECK(game.isArmed() && game.score() == 0);

  // Spinner jitter and a screw limit switch are not moves.
  for (int i = 0; i < 2000; i++) {
    p.spinnerTotal = (i % 2) ? 3 : -3;
    game.update(p, 5000 + static_cast<uint32_t>(i));
  }
  p.pressed = 1u << SwitchBit::kScrewHome;
  p.switches = 1u << SwitchBit::kScrewHome;
  game.update(p, 7000);
  CHECK(game.isArmed());

  p.pressed = 1u << SwitchBit::kClicker;  // first real move at 8 s
  game.update(p, 8000);
  CHECK(game.isRunning() && game.score() == 10);
  p.pressed = 0;
  game.update(p, 27999);
  CHECK(game.isRunning());
  game.update(p, 28000);  // 20 s after the last move
  CHECK(game.isFinished());
  const ScoreEntry result = game.result(0);
  CHECK(result.startUnix == 108);  // armed at 100 s, started 8 s later
  CHECK(result.durationS == 20 && result.score == 10 && result.actions == 1);
  CHECK(result.flags == (RecordFlag::kCompleted | RecordFlag::kNewBest));

  BasicGame idleGame;
  idleGame.arm(BasicModeId::kFreePlay, 0, 0, false);
  idleGame.update(p, 0);
  idleGame.update(p, 600000);  // nobody plays: it stays armed, never "finishes"
  CHECK(idleGame.isArmed());
  idleGame.cancel(600000);
  CHECK(!idleGame.isArmed() && !idleGame.isFinished());
}

static void testMovesMatchTheApp() {
  InputPacket before = idle();
  before.switches = (1u << SwitchBit::kRocker) | (1u << SwitchBit::kStylusStowed);
  InputPacket after = idle();
  after.pressed = (1u << SwitchBit::kSliderHigh) | (1u << SwitchBit::kNavRight) | (1u << SwitchBit::kScrewOut);
  after.switches = after.pressed;  // rocker flipped off, stylus taken out, screw limit reached
  const MoveCount moves = BasicGame::countMoves(before, after);
  CHECK(moves.presses == 4);  // slider, menu key, rocker flip, stylus out; not the limit switch

  SpinSteps steps;
  steps.reset(0);
  CHECK(steps.available(1023, 1024) == 0);
  CHECK(steps.take(2100, 1024) == 2);
  CHECK(steps.take(1100, 1024) == 0);  // back 1000 from the counted 2048: not a full step
  CHECK(steps.take(1000, 1024) == 1);  // back 1048
}

static void testScoreEvents() {
  ScoreEventTracker t;
  const ScoreEvent start = t.start(250);
  CHECK(start.kind == ScoreEventKind::kGameStart && start.value == 250);
  ScoreEvent out[ScoreEventTracker::kMaxEventsPerChange];
  CHECK(t.onScore(90, out, 6) == 1 && out[0].kind == ScoreEventKind::kPoints && out[0].value == 90);
  CHECK(t.onScore(90, out, 6) == 0);  // no change, no events
  size_t n = t.onScore(210, out, 6);  // +120 crosses 100 and 200
  CHECK(n == 3 && out[1].kind == ScoreEventKind::kMilestone && out[1].value == 100 && out[2].value == 200);
  n = t.onScore(260, out, 6);  // passes the old best of 250
  CHECK(n == 2 && out[1].kind == ScoreEventKind::kNewBest && out[1].value == 250 && out[1].score == 260);
  n = t.onScore(300, out, 6);  // newBest only once
  CHECK(n == 2 && out[1].kind == ScoreEventKind::kMilestone && t.beatBest());
  const ScoreEvent end = t.end();
  CHECK(end.kind == ScoreEventKind::kGameEnd && end.score == 300 && end.value == 250);

  ScoreEventTracker first;
  first.start(0);  // no earlier best: nothing to beat during play
  CHECK(first.onScore(500, out, 6) == 6 && out[5].kind == ScoreEventKind::kMilestone);
}

static void testApprovedApps() {
  ApprovedApps apps;
  for (uint32_t id = 1; id <= ApprovedApps::kCapacity; id++) apps.remember(id);
  CHECK(apps.count() == ApprovedApps::kCapacity && apps.contains(1));
  apps.remember(1);    // most recent again
  apps.remember(100);  // full: drops the least recent, which is now 2
  CHECK(apps.contains(1) && apps.contains(100) && !apps.contains(2) && apps.count() == ApprovedApps::kCapacity);
  uint8_t saved[ApprovedApps::kSerializedBytes];
  apps.serialize(saved);
  ApprovedApps restored;
  CHECK(restored.deserialize(saved, sizeof(saved)) && restored.contains(100) && !restored.contains(2));
  saved[1] = 99;
  CHECK(!restored.deserialize(saved, sizeof(saved)) && restored.count() == 0);
}

static void testConnectionApproval() {
  using Action = ConnectionApproval::Action;
  ApprovedApps apps;
  ConnectionApproval gate;
  gate.onConnect(0);
  CHECK(gate.update(1999) == Action::kNone);
  CHECK(gate.onHello(42, "Ryan's Pixel", 500, apps) == Action::kSendWaiting);
  CHECK(gate.asking() && strcmp(gate.phoneName(), "RYAN'S PIXEL") == 0);
  CHECK(gate.secondsLeftToAnswer(10500) == 20);
  CHECK(gate.answer(true, apps) == Action::kSendAccepted && gate.approved() && apps.contains(42));

  gate.onDisconnect();  // the same phone comes back: no question
  gate.onConnect(60000);
  CHECK(gate.onHello(42, "Ryan's Pixel", 60100, apps) == Action::kSendAccepted && gate.approved());

  gate.onConnect(0);  // a new phone, and the child says no
  CHECK(gate.onHello(7, "", 0, apps) == Action::kSendWaiting && strcmp(gate.phoneName(), "A PHONE") == 0);
  CHECK(gate.answer(false, apps) == Action::kSendDeclinedAndDisconnect && !apps.contains(7));

  gate.onConnect(0);  // nRF Connect: never says hello
  CHECK(gate.update(2000) == Action::kSendWaiting && gate.asking());
  CHECK(gate.update(31999) == Action::kNone);
  CHECK(gate.update(32000) == Action::kSendDeclinedAndDisconnect && !gate.approved());
  CHECK(gate.answer(true, apps) == Action::kNone);  // too late
}

static void testBattery() {
  CHECK(batteryMillivoltsFromAdc(0) == 0);
  const uint32_t mv = batteryMillivoltsFromAdc(1600);  // 1.406 V at the pin
  CHECK(mv >= 4155 && mv <= 4170);
  CHECK(batteryPercentFromMillivolts(4300) == 100 && batteryPercentFromMillivolts(4200) == 100);
  CHECK(batteryPercentFromMillivolts(3800) == 52);
  CHECK(batteryPercentFromMillivolts(3725) == 36);  // halfway between 3700 (30) and 3750 (42)
  CHECK(batteryPercentFromMillivolts(3200) == 0);
  BatteryGauge gauge;
  CHECK(gauge.update(3800) == 52);
  CHECK(gauge.update(3810) == 52);  // small wobble: shown value holds
  for (int i = 0; i < 40; i++) gauge.update(3700);
  CHECK(gauge.percent() <= 32 && gauge.percent() >= 30);
}

static void testCelebration() {
  Celebration c;
  CHECK(c.start(ScoreEventKind::kNewBest, 260, 250, 1000));
  CHECK(!c.start(ScoreEventKind::kPoints, 270, 10, 1500));     // a pop never cuts a new best short
  CHECK(!c.start(ScoreEventKind::kMilestone, 300, 300, 2000)); // nor does a milestone
  CHECK(c.active(3499) && !c.active(3500));
  CHECK(c.start(ScoreEventKind::kPoints, 310, 10, 3500) && !c.fullScreen());
  CHECK(c.start(ScoreEventKind::kMilestone, 400, 400, 3600) && c.kind() == ScoreEventKind::kMilestone);
  CHECK(c.elapsedMs(3700) == 100);
  CelebrationStyle end = celebrationStyle(ScoreEventKind::kGameEnd, true);
  CHECK(end.durationMs == 0 && end.effectCount == 2 && end.effects[0] == 12);
  CHECK(celebrationStyle(ScoreEventKind::kGameEnd, false).effects[0] == 10);
  CHECK(!c.start(99, 0, 0, 0));
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
  testFreePlayStartsOnFirstMove();
  testMovesMatchTheApp();
  testScoreEvents();
  testApprovedApps();
  testConnectionApproval();
  testBattery();
  testCelebration();
  if (failures) {
    fprintf(stderr, "%d check(s) failed\n", failures);
    return 1;
  }
  printf("firmware host tests passed\n");
  return 0;
}
