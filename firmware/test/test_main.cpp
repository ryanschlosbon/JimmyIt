// Host-side tests for the portable firmware modules. Build and run: `make -C firmware/test`.
#include <stdio.h>
#include <string.h>

#include <initializer_list>

#include "basic_modes.h"
#include "battery_level.h"
#include "celebration.h"
#include "connection_approval.h"
#include "fidget_protocol.h"
#include "haptic_feedback.h"
#include "input_helpers.h"
#include "result_animation.h"
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

// Spin Count: only quarter turns of the spinner or the screw score, +5 each,
// and there is no clock: it ends like Free Play.
static void testSpinCount() {
  BasicGame game;
  CHECK(game.start(BasicModeId::kSpinCount, 1000, 0, false));
  InputPacket p = idle();
  game.update(p, 1000);  // baseline
  p.spinnerTotal = kSpinnerCountsPerTurn * 2 + 100;  // 8 quarter turns
  game.update(p, 1500);
  p.spinnerTotal = -kSpinnerCountsPerTurn;  // back 3 turns and a bit: 12 more from the counted spot
  game.update(p, 2000);
  CHECK(game.score() == 100);
  p.screwTotal = 13;  // two quarter turns of the screw (and one detent toward the next)
  p.pressed = 1u << SwitchBit::kClicker;  // a press: a move, but it doesn't score here
  game.update(p, 2500);
  CHECK(game.score() == 110 && game.actions() == 22);
  p.pressed = 0;
  game.update(p, 60000);  // no 30 s clock any more: idle since 2.5 s, so it ended at 5.5 s
  CHECK(game.isFinished());
  const ScoreEntry result = game.result(40);
  CHECK(result.durationS == 4);
  CHECK(result.flags == (RecordFlag::kCompleted | RecordFlag::kNewBest));
}

static void testFreePlay() {
  BasicGame game;
  CHECK(game.start(BasicModeId::kFreePlay, 0, 1760000000, true));
  InputPacket p = idle();
  game.update(p, 0);
  p.pressed = (1 << SwitchBit::kClicker) | (1 << SwitchBit::kNavLeft);  // 2 presses: +20
  p.screwTotal = -13;                                                  // 2 screw quarter turns: +10
  p.spinnerTotal = kSpinnerCountsPerTurn / 4;                          // a 90° spin: +5
  game.update(p, 1000);
  CHECK(game.score() == 35 && game.actions() == 5);
  p.pressed = 0;
  p.screwTotal = -14;  // 2 detents past the last counted spot: not a move
  game.update(p, 3999);
  CHECK(game.isRunning() && game.score() == 35);
  game.update(p, 4000);  // 3 s after the last move: 2 s idle, then 1 s of grace
  CHECK(game.isFinished());
  const ScoreEntry result = game.result(100);
  CHECK(result.flags == (RecordFlag::kClockSet | RecordFlag::kCompleted));
  CHECK(result.startUnix == 1760000000 && result.actions == 5 && result.durationS == 4);

  CHECK(!game.start(99, 0, 0, false));
  CHECK(game.start(BasicModeId::kFreePlay, 0, 0, false));
  game.cancel(500);
  CHECK((game.result(0).flags & RecordFlag::kCompleted) == 0);
}

// After 2 s with no move the game is in grace: a bar runs down for 1 s. A move
// in grace carries on as normal; when grace runs out the game ends.
static void testGrace() {
  BasicGame game;
  CHECK(game.graceRemaining(0) == BasicGame::kNotInGrace);  // not running
  game.start(BasicModeId::kFreePlay, 0, 0, false);
  InputPacket p = idle();
  game.update(p, 0);
  p.pressed = 1u << SwitchBit::kClicker;
  game.update(p, 1000);
  p.pressed = 0;
  game.update(p, 2999);
  CHECK(game.graceRemaining(2999) == BasicGame::kNotInGrace);
  game.update(p, 3000);
  CHECK(game.isRunning() && game.graceRemaining(3000) == 1.0f);
  game.update(p, 3500);
  CHECK(game.graceRemaining(3500) == 0.5f);
  p.pressed = 1u << SwitchBit::kClicker;  // a move in grace: back to normal play
  game.update(p, 3900);
  CHECK(game.isRunning() && game.score() == 20 && game.graceRemaining(3900) == BasicGame::kNotInGrace);
  p.pressed = 0;
  game.update(p, 6899);
  CHECK(game.isRunning() && game.graceRemaining(6899) > 0.0f);
  game.update(p, 6950);  // a late update still ends it exactly when grace ran out
  CHECK(game.isFinished() && game.result(0).durationS == 6);
  CHECK(game.graceRemaining(6950) == BasicGame::kNotInGrace);

  // Spin Count has the same grace, and any move keeps it going.
  BasicGame spin;
  spin.start(BasicModeId::kSpinCount, 0, 0, false);
  InputPacket q = idle();
  spin.update(q, 0);
  q.pressed = 1u << SwitchBit::kSliderHigh;
  spin.update(q, 2500);  // in grace, a slide: no points, but still playing
  q.pressed = 0;
  spin.update(q, 4400);
  CHECK(spin.isRunning() && spin.score() == 0 && spin.graceRemaining(4400) == BasicGame::kNotInGrace);
  spin.update(q, 5500);
  CHECK(spin.isFinished());
}

// Neither game runs longer than 3 minutes, however busy the child is.
static void testThreeMinuteCap() {
  for (uint8_t mode : {BasicModeId::kFreePlay, BasicModeId::kSpinCount}) {
    BasicGame game;
    game.start(mode, 1000, 0, false);
    InputPacket p = idle();
    game.update(p, 1000);
    uint32_t now = 1000;
    for (; now < 1000 + BasicGame::kMaxMs + 5000 && !game.isFinished(); now += 500) {
      p.spinnerTotal += BasicGame::kSpinCountsPerMove;  // a quarter turn every half second
      game.update(p, now);
    }
    CHECK(game.isFinished());
    CHECK(game.result(0).durationS == BasicGame::kMaxMs / 1000);
    CHECK((game.result(0).flags & RecordFlag::kCompleted) != 0);
  }
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

  // Spinner jitter, wiggling the screw by a detent and a screw limit switch are not moves.
  for (int i = 0; i < 2000; i++) {
    p.spinnerTotal = (i % 2) ? 3 : -3;
    p.screwTotal = static_cast<int16_t>(i % 2);
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
  game.update(p, 10999);
  CHECK(game.isRunning());
  game.update(p, 11000);  // 3 s after the last move
  CHECK(game.isFinished());
  const ScoreEntry result = game.result(0);
  CHECK(result.startUnix == 108);  // armed at 100 s, started 8 s later
  CHECK(result.durationS == 3 && result.score == 10 && result.actions == 1);
  CHECK(result.flags == (RecordFlag::kCompleted | RecordFlag::kNewBest));

  BasicGame screwStart;  // a quarter turn of the screw starts it too
  screwStart.arm(BasicModeId::kFreePlay, 0, 0, false);
  InputPacket s = idle();
  screwStart.update(s, 0);
  s.screwTotal = 5;
  screwStart.update(s, 100);
  CHECK(screwStart.isArmed());
  s.screwTotal = 6;
  screwStart.update(s, 200);
  CHECK(screwStart.isRunning() && screwStart.score() == 5);

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
  after.pressed = (1u << SwitchBit::kSliderHigh) | (1u << SwitchBit::kNavRight) | (1u << SwitchBit::kScrewOut) |
                  (1u << SwitchBit::kScrewPush);
  after.switches = after.pressed;  // rocker flipped off, stylus taken out, screw limit reached
  const MoveCount moves = BasicGame::countMoves(before, after);
  CHECK(moves.presses == 5);  // slider, menu key, screw push, rocker flip, stylus out; not the limit switch

  SpinSteps steps;
  steps.reset(0);
  CHECK(steps.available(1023, 1024) == 0);
  CHECK(steps.take(2100, 1024) == 2);
  CHECK(steps.take(1100, 1024) == 0);  // back 1000 from the counted 2048: not a full step
  CHECK(steps.take(1000, 1024) == 1);  // back 1048

  // Screw moves: a quarter turn (6 detents) from the last counted position, the
  // same steps as toy-actions.test.ts in packages/core.
  CHECK(BasicGame::kScrewDetentsPerMove == 6);
  SpinSteps screw;
  screw.reset(0);
  CHECK(screw.take(1, 6) == 0 && screw.take(5, 6) == 0 && screw.take(6, 6) == 1);
  CHECK(screw.take(19, 6) == 2);  // counted up to 18
  CHECK(screw.take(13, 6) == 0);  // 5 below the counted 18
  CHECK(screw.take(12, 6) == 1);

  // screwTotal is 16 bits on the wire and wraps; BasicGame unwraps it.
  BasicGame game;
  game.start(BasicModeId::kSpinCount, 0, 0, false);
  InputPacket p = idle();
  p.screwTotal = 32765;
  game.update(p, 0);
  p.screwTotal = -32765;  // +6 detents across the wrap
  game.update(p, 100);
  CHECK(game.score() == 5);
}

// Same cases as packages/core/src/scoring/score-events.test.ts: both sides must agree.
static void testScoreEvents() {
  ScoreEventTracker t;
  const ScoreEvent start = t.start(250);
  CHECK(start.kind == ScoreEventKind::kGameStart && start.value == 250);
  ScoreEvent out[ScoreEventTracker::kMaxEventsPerChange];
  const size_t max = ScoreEventTracker::kMaxEventsPerChange;
  CHECK(t.onScore(90, out, max) == 1 && out[0].kind == ScoreEventKind::kPoints && out[0].value == 90);
  CHECK(t.onScore(90, out, max) == 0);  // no change, no events
  size_t n = t.onScore(210, out, max);  // +120 crosses 100
  CHECK(n == 2 && out[1].kind == ScoreEventKind::kMilestone && out[1].value == 100);
  n = t.onScore(260, out, max);  // passes the old best of 250
  CHECK(n == 2 && out[1].kind == ScoreEventKind::kNewBest && out[1].value == 250 && out[1].score == 260);
  n = t.onScore(400, out, max);  // 200, 300, 400 are not milestones
  CHECK(n == 1 && out[0].kind == ScoreEventKind::kPoints && out[0].value == 140);
  n = t.onScore(520, out, max);  // newBest only once
  CHECK(n == 2 && out[1].kind == ScoreEventKind::kMilestone && out[1].value == 500 && t.beatBest());
  const ScoreEvent end = t.end();
  CHECK(end.kind == ScoreEventKind::kGameEnd && end.score == 520 && end.value == 250);

  ScoreEventTracker first;
  first.start(0);  // no earlier best: nothing to beat during play
  n = first.onScore(3200, out, max);
  const uint32_t expected[] = {100, 500, 1000, 1500, 2000, 3000};
  CHECK(n == 7);
  for (size_t i = 0; i < 6; i++) CHECK(out[i + 1].kind == ScoreEventKind::kMilestone && out[i + 1].value == expected[i]);
  n = first.onScore(5000, out, max);  // every 1000 after 3000
  CHECK(n == 3 && out[1].value == 4000 && out[2].value == 5000);
  CHECK(first.onScore(5999, out, max) == 1);

  CHECK(nextMilestoneAfter(0) == 100 && nextMilestoneAfter(100) == 500 && nextMilestoneAfter(2999) == 3000);
  CHECK(nextMilestoneAfter(3000) == 4000 && nextMilestoneAfter(12345) == 13000);
  ScoreEventTracker huge;
  huge.start(0);
  huge.onScore(0xfffff000u, out, max);
  n = huge.onScore(0xffffffffu, out, max);  // the last milestones below the top, then stops instead of wrapping
  CHECK(n == 5 && out[4].value == 4294967000u);
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
  CHECK(!c.start(ScoreEventKind::kMilestone, 500, 500, 2000)); // nor does a milestone
  CHECK(c.active(3499) && !c.active(3500));
  CHECK(c.start(ScoreEventKind::kPoints, 310, 10, 3500) && !c.fullScreen());
  CHECK(c.start(ScoreEventKind::kMilestone, 500, 500, 3600) && c.kind() == ScoreEventKind::kMilestone);
  CHECK(c.elapsedMs(3700) == 100);
  CHECK(!c.start(99, 0, 0, 0));
}

static bool effectsAre(const CelebrationStyle& style, std::initializer_list<uint8_t> ids) {
  if (style.effectCount != ids.size()) return false;
  size_t i = 0;
  for (uint8_t id : ids) {
    if (style.effects[i++] != id) return false;
  }
  return true;
}

// Haptics for score moments (PROTOCOL.md "Score events"): none for gameStart and
// points (the move already tapped or rumbled), stronger for bigger milestones,
// and the strongest for a new high score.
static void testCelebrationHaptics() {
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kGameStart), {}));
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kPoints, 10), {}));
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kMilestone, 100), {10}));
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kMilestone, 500), {12}));
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kMilestone, 1000), {12, 47}));
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kMilestone, 2000), {12, 47}));
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kMilestone, 3000), {12, 14}));
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kMilestone, 9000), {12, 14}));
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kNewBest, 250), {14, 12, 14}));
  CelebrationStyle end = celebrationStyle(ScoreEventKind::kGameEnd, 0, true);
  CHECK(end.durationMs == 0 && effectsAre(end, {12, 14}));
  CHECK(effectsAre(celebrationStyle(ScoreEventKind::kGameEnd, 0, false), {10}));
  CHECK(kInputTapEffect == 4);  // Sharp Click - 100%
}

static void testInputTaps() {
  const uint16_t clicker = 1u << SwitchBit::kClicker;
  const uint16_t rocker = 1u << SwitchBit::kRocker;
  CHECK(inputTaps(0, clicker));
  CHECK(!inputTaps(clicker, 0));  // letting go is quiet
  CHECK(!inputTaps(clicker, clicker));  // held: one tap only
  CHECK(inputTaps(0, 1u << SwitchBit::kScrewPush) && inputTaps(0, 1u << SwitchBit::kSliderLow));
  CHECK(inputTaps(0, rocker) && inputTaps(rocker, 0));  // the rocker taps both ways
  CHECK(!inputTaps(0, 1u << SwitchBit::kScrewHome));  // limit switches are positions
  CHECK(!inputTaps(1u << SwitchBit::kStylusStowed, 0) && !inputTaps(0, 1u << SwitchBit::kStylusStowed));
}

static void testRumble() {
  RumbleEnvelope r;
  CHECK(r.update(0, 0, 0) == 0);  // baseline
  // Sensor jitter at rest never rumbles.
  for (uint32_t t = 1; t <= 400; t++) CHECK(r.update((t % 2) ? 5 : -5, 0, t) == 0);

  // A slow screw turn: one detent in a 40 ms window is about 1 turn/s.
  CHECK(r.update(0, 1, 410) == 0);  // still inside the window
  const uint8_t slow = r.update(0, 1, 440);
  CHECK(slow > RumbleEnvelope::kMinAmplitude && slow < RumbleEnvelope::kMaxAmplitude);
  CHECK(r.amplitude(480) == slow);  // held until the next window could refresh it
  const uint8_t fading = r.amplitude(535);
  CHECK(fading > 0 && fading < slow);
  CHECK(r.amplitude(580) > 0 && r.amplitude(590) == 0);  // gone 150 ms after the last motion

  // A fast spin is full strength; the spinner and the screw add up.
  RumbleEnvelope fast;
  fast.reset(0, 0, 0);
  CHECK(fast.update(kSpinnerCountsPerTurn / 8, 0, 40) == RumbleEnvelope::kMaxAmplitude);  // 1/8 turn in 40 ms
  RumbleEnvelope both;
  both.reset(0, 0, 0);
  const uint8_t a = both.update(100, 0, 40);  // a slow spin alone
  RumbleEnvelope combined;
  combined.reset(0, 0, 0);
  const uint8_t b = combined.update(100, 1, 40);  // the same spin plus a detent
  CHECK(a >= RumbleEnvelope::kMinAmplitude && b > a);

  // Small spinner motion still counts once it adds up past the deadband.
  RumbleEnvelope creep;
  creep.reset(0, 0, 0);
  uint8_t felt = 0;
  for (uint32_t t = 1; t <= 200; t++) felt |= creep.update(static_cast<int32_t>(t), 0, t);
  CHECK(felt > 0);
}

static void testResultAnimation() {
  using A = ResultAnimation;
  // The opening beat: the score alone, centered, with sparkles all over.
  ResultFrame f = A::frame(0);
  CHECK(f.fieldSparkles && !f.showJimmy && f.scoreCenterX == A::kScoreCenterStart);
  f = A::frame(A::kHoldMs - 1);
  CHECK(!f.showJimmy && f.scoreCenterX == A::kScoreCenterStart);

  // Jimmy comes in from past the right edge and pushes the score left as he goes.
  f = A::frame(A::kHoldMs);
  CHECK(f.showJimmy && !f.fieldSparkles && f.jimmyX - A::kJimmyRadius >= A::kScreenWidth);
  int16_t lastJimmyX = f.jimmyX;
  int16_t lastScoreX = f.scoreCenterX;
  for (uint32_t ms = A::kHoldMs; ms <= A::kHoldMs + A::kSlideMs; ms += 50) {
    f = A::frame(ms);
    CHECK(f.jimmyX <= lastJimmyX && f.scoreCenterX <= lastScoreX && f.jimmyY == A::kJimmyRestY);
    lastJimmyX = f.jimmyX;
    lastScoreX = f.scoreCenterX;
  }
  f = A::frame(A::kHoldMs + A::kSlideMs);
  CHECK(f.jimmyX == A::kJimmyRestX && f.scoreCenterX == A::kScoreCenterEnd && f.tiltDeg == 0.0f && !f.burst);

  // Settled in place, he tips over a little with his eyes squeezed into a smile, then rights himself.
  const uint32_t tiltStart = A::kHoldMs + A::kSlideMs;
  CHECK(A::frame(tiltStart).squint && A::frame(tiltStart).jimmyY == A::kJimmyRestY);
  f = A::frame(tiltStart + A::kTiltMs / 2);
  CHECK(f.squint && f.tiltDeg > A::kTiltDeg * 0.9f && f.tiltDeg <= A::kTiltDeg && f.jimmyY == A::kJimmyRestY);

  // Then one short hop, eyes open again: up and back down, the top in the middle.
  const uint32_t hopStart = tiltStart + A::kTiltMs;
  f = A::frame(hopStart);
  CHECK(!f.squint && f.tiltDeg == 0.0f && f.jimmyY == A::kJimmyRestY && !f.burst);
  f = A::frame(hopStart + A::kHopMs / 2);
  CHECK(f.jimmyY == A::kJimmyRestY - A::kHopHeight && f.jimmyX == A::kJimmyRestX && f.tiltDeg == 0.0f);
  CHECK(A::frame(hopStart + A::kHopMs / 4).jimmyY > A::kJimmyRestY - A::kHopHeight);

  // Landing: back on the ground with a burst of sparkles.
  const uint32_t landed = hopStart + A::kHopMs;
  f = A::frame(landed);
  CHECK(f.jimmyY == A::kJimmyRestY && f.burst && f.burstProgress == 0.0f && !f.squint);
  CHECK(!A::frame(landed + A::kBurstMs).burst);

  // Then it holds still until the screen is done, all within the result screen's time.
  f = A::frame(A::kTotalMs - 1);
  CHECK(f.showJimmy && !f.burst && !f.squint && f.tiltDeg == 0.0f && f.jimmyX == A::kJimmyRestX
        && f.scoreCenterX == A::kScoreCenterEnd);
  CHECK(landed + A::kBurstMs + 1000 <= A::kTotalMs);  // a moment to enjoy it before the ready screen
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
  testGrace();
  testThreeMinuteCap();
  testFreePlayStartsOnFirstMove();
  testMovesMatchTheApp();
  testScoreEvents();
  testApprovedApps();
  testConnectionApproval();
  testBattery();
  testCelebration();
  testCelebrationHaptics();
  testInputTaps();
  testRumble();
  testResultAnimation();
  if (failures) {
    fprintf(stderr, "%d check(s) failed\n", failures);
    return 1;
  }
  printf("firmware host tests passed\n");
  return 0;
}
