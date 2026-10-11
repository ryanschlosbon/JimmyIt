// JimmyIt fidget firmware. Board: "Seeed nRF52 Boards" > "Seeed XIAO nRF52840".
//
// Grew out of the KnightHacks breadboard sketch "Fidget Quest": same screens and
// points-per-move game, now non-blocking, saved to flash, and talking to the
// app over Bluetooth (spec: packages/protocol/PROTOCOL.md).
//
// - Without the app the toy plays by itself: the first move starts Free Play and
//   scores; after 2 s with no move a bar runs down for 1 s, and the game ends
//   unless the child moves again. Every game is saved to flash and uploaded the
//   next time the app connects.
// - Score moments (game start, points, milestones, new high score, game end) play
//   an animation, and the big ones a haptic, whether the toy or the app runs the game.
// - Every press taps and every spin or screw turn rumbles, in every mode.
// - A phone may only connect once the child says yes on the toy (left = no,
//   right = yes); approved phones are remembered.
//
// Files: board_config.h (what is wired up), hardware_inputs (reading parts),
// oled_ui (screens and animations), ble_link (Bluetooth), haptics,
// battery_monitor, score_storage (flash). Logic that can run on a laptop is in
// src/ and tested by `npm run test:firmware`.

#include <Arduino.h>
#include <Wire.h>

#include "battery_monitor.h"
#include "ble_link.h"
#include "board_config.h"
#include "hardware_inputs.h"
#include "haptics.h"
#include "oled_ui.h"
#include "score_storage.h"
#include "src/basic_modes.h"
#include "src/boot_animation.h"
#include "src/celebration.h"
#include "src/connection_approval.h"
#include "src/fidget_protocol.h"
#include "src/haptic_feedback.h"
#include "src/input_helpers.h"
#include "src/result_animation.h"
#include "src/score_events.h"
#include "src/score_log.h"

using namespace jimmyit;

enum class Screen : uint8_t { Boot, Welcome, Instructions, Ready, Playing, Result, Notice, App };

constexpr uint32_t kWelcomeMs = 5000;
constexpr uint32_t kInstructionsMs = 10000;
constexpr uint32_t kResultMs = jimmyit::ResultAnimation::kTotalMs;  // the score, then Jimmy's hop
constexpr uint32_t kNoticeMs = 2000;
constexpr uint32_t kForgetPhonesHoldMs = 5000;
constexpr uint32_t kDeclineDisconnectDelayMs = 300;  // lets the "declined" message go out first
constexpr uint32_t kAnimationFrameMs = 60;
constexpr uint32_t kBootFrameMs = 33;  // ~30 fps, so Jimmy's roll stays smooth (a frame takes ~25 ms at 400 kHz)
constexpr uint32_t kMinNotifyGapMs = 20;  // at most 50 input notifications a second
constexpr uint32_t kHeartbeatMs = 1000;

// Games the toy offers by itself; the menu keys pick one on the Ready screen.
// Spin Count needs the spinner sensor or the screw, so the breadboard only has Free Play.
constexpr uint8_t kToyGames[] = {
    BasicModeId::kFreePlay,
#if JIMMYIT_HAS_AS5600 || JIMMYIT_HAS_ENCODER
    BasicModeId::kSpinCount,
#endif
};
constexpr size_t kToyGameCount = sizeof(kToyGames) / sizeof(kToyGames[0]);
constexpr uint16_t kNavBits = (1u << SwitchBit::kNavLeft) | (1u << SwitchBit::kNavRight);
// While there is a menu, the menu keys choose a game on Ready instead of starting one.
constexpr uint16_t kMenuBits = kToyGameCount > 1 ? kNavBits : 0;

namespace {

Screen screen = Screen::Boot;
uint32_t screenStartMs = 0;
bool redraw = true;
size_t selectedGame = 0;
bool graceShown = false;  // the Playing screen shows the bar that runs down before the game ends
uint32_t lastScreenFrameMs = 0;
bool linked = false;

uint8_t fidgetMode = FidgetMode::kStandalone;
ScoreLog scoreLog;
BasicGame game;
ScoreEventTracker scoreEvents;
Celebration celebration;
uint32_t lastFrameMs = 0;
bool wasAnimating = false;
uint32_t resultScore = 0;
bool resultNewBest = false;
AppDisplay appDisplay = {};
const char* noticeText = "";
// The app game that just ended (from its gameEnd moment), shown when the app hands the toy back.
bool appResultPending = false;
uint32_t appResultScore = 0;
bool appResultNewBest = false;

ConnectionApproval approval;
ApprovedApps approvedApps;
uint32_t promptSecondsShown = 0;
bool disconnectPending = false;
uint32_t disconnectAtMs = 0;
uint32_t bothMenuKeysSinceMs = 0;

SwitchDebouncer debouncer(kDebounceMs);
SpinnerTracker spinner;
RumbleEnvelope rumble;
bool inputsStarted = false;  // the first reading is only the debounce baseline: no tap for a switch already closed
InputPacket current = {};
InputPacket lastSent = {};
bool sentOnce = false;
uint16_t pressedForNotify = 0;  // presses not yet reported to the app
uint16_t pressedForGame = 0;    // presses not yet given to the game or a prompt
uint32_t lastNotifyMs = 0;

bool clockSet = false;
uint32_t clockUnixAtSet = 0;
uint32_t clockMillisAtSet = 0;

uint32_t unixNow(uint32_t nowMs) { return clockUnixAtSet + (nowMs - clockMillisAtSet) / 1000; }

DeviceInfo makeInfo() {
  DeviceInfo info = {};
  info.protocolVersion = kProtocolVersion;
  info.firmwareMajor = JIMMYIT_FIRMWARE_MAJOR;
  info.firmwareMinor = JIMMYIT_FIRMWARE_MINOR;
  info.firmwarePatch = JIMMYIT_FIRMWARE_PATCH;
  info.deviceId = NRF_FICR->DEVICEID[0];
  info.capabilities = Capability::kDisplay | Capability::kScoreLog | Capability::kStandaloneModes |
                      Capability::kScoreEvents | Capability::kApproval |
                      (hapticsAvailable() ? Capability::kHaptics : 0);
  info.newestRecordId = scoreLog.newestRecordId();
  info.storedRecordCount = static_cast<uint16_t>(scoreLog.count());
  return info;
}

void goTo(Screen next, uint32_t nowMs) {
  screen = next;
  screenStartMs = nowMs;
  redraw = true;
}

const char* gameTitle(uint8_t modeId) { return modeId == BasicModeId::kSpinCount ? "SPIN COUNT" : "FREE PLAY"; }

// ---- Celebrations (score events) --------------------------------------------

// Animation + haptic for one score moment. A bigger animation that is still
// playing wins, and then this moment stays quiet (no haptic either).
void celebrate(uint8_t kind, uint32_t score, uint32_t value, uint32_t nowMs, bool newBestAtEnd = false) {
  if (!celebration.start(kind, score, value, nowMs, newBestAtEnd)) return;
  const CelebrationStyle style = celebrationStyle(kind, value, newBestAtEnd);
  hapticsPlay(style.effects, style.effectCount);
  lastFrameMs = 0;  // draw the first frame now
}

// A moment in a game the toy is running: celebrate here and tell the app.
void emitScoreEvent(const ScoreEvent& event, uint32_t nowMs, bool newBestAtEnd = false) {
  celebrate(event.kind, event.score, event.value, nowMs, newBestAtEnd);
  if (!approval.approved()) return;
  ScoreEventMessage message = {};
  message.type = MessageType::kScoreEvent;
  message.kind = event.kind;
  message.modeId = game.modeId();
  message.score = event.score;
  message.value = event.value;
  bleSendMessage(&message, sizeof(message));
}

void emitScoreChanges(uint32_t nowMs) {
  ScoreEvent events[ScoreEventTracker::kMaxEventsPerChange];
  const size_t count = scoreEvents.onScore(game.score(), events, ScoreEventTracker::kMaxEventsPerChange);
  for (size_t i = 0; i < count; i++) emitScoreEvent(events[i], nowMs);
}

// ---- Scores ---------------------------------------------------------------

// Ready screen: the selected game waits for the child's first move.
void armGame(uint32_t nowMs) {
  game.arm(kToyGames[selectedGame], nowMs, clockSet ? unixNow(nowMs) : nowMs / 1000, clockSet);
  pressedForGame = 0;
  graceShown = false;
  goTo(Screen::Ready, nowMs);
}

// Saves a finished game to flash and sends it to the app if one is listening.
void recordFinishedGame() {
  ScoreEntry entry = game.result(scoreLog.best(game.modeId()));
  resultScore = entry.score;
  resultNewBest = (entry.flags & RecordFlag::kNewBest) != 0;
  Serial.print("Game over. Points: ");
  Serial.println(entry.score);
  if (entry.score == 0) return;  // nothing was played; not worth a record

  entry.recordId = scoreLog.add(entry);
  scoreLog.raiseBest(entry.modeId, entry.score);
  if (!storageSave(scoreLog)) Serial.println("Could not save scores to flash");
  bleSetInfo(makeInfo());
  if (!approval.approved()) return;
  const RecordMessage message = toRecordMessage(entry);
  bleSendMessage(&message, sizeof(message));
}

void sendRecordsAfter(uint32_t afterRecordId) {
  static ScoreEntry entries[ScoreLog::kCapacity];  // static: too big for the stack
  const size_t count = scoreLog.collectAfter(afterRecordId, entries, ScoreLog::kCapacity);
  uint16_t sent = 0;
  for (size_t i = 0; i < count; i++) {
    const RecordMessage message = toRecordMessage(entries[i]);
    if (bleSendMessage(&message, sizeof(message))) sent++;
  }
  SyncDoneMessage done = {};
  done.type = MessageType::kSyncDone;
  done.newestRecordId = scoreLog.newestRecordId();
  done.sentCount = sent;
  bleSendMessage(&done, sizeof(done));
}

// ---- Connecting: the child says yes on the toy -------------------------------

void sendApproval(uint8_t status) {
  ApprovalMessage message = {};
  message.type = MessageType::kApproval;
  message.status = status;
  bleSendMessage(&message, sizeof(message));
}

void applyApproval(ConnectionApproval::Action action, uint32_t nowMs) {
  switch (action) {
    case ConnectionApproval::Action::kNone:
      return;
    case ConnectionApproval::Action::kSendWaiting:
      Serial.print("Asking about ");
      Serial.println(approval.phoneName());
      sendApproval(ApprovalStatus::kWaiting);
      celebration.cancel();
      static constexpr uint8_t kAttention[] = {7};  // a soft bump: "look at me"
      hapticsPlay(kAttention, 1);
      break;
    case ConnectionApproval::Action::kSendAccepted:
      Serial.println("Phone approved");
      sendApproval(ApprovalStatus::kAccepted);
      storageSaveApprovedApps(approvedApps);
      pressedForNotify = 0;
      break;
    case ConnectionApproval::Action::kSendDeclinedAndDisconnect:
      Serial.println("Phone declined");
      sendApproval(ApprovalStatus::kDeclined);
      disconnectPending = true;
      disconnectAtMs = nowMs + kDeclineDisconnectDelayMs;
      break;
  }
  redraw = true;
}

// While the question is on screen, the menu keys (or the clicker) answer it.
void answerPrompt(uint32_t nowMs) {
  const uint16_t pressed = pressedForGame;
  pressedForGame = 0;  // nothing reaches the game while the question is up
  if (inputsHaveMenuKeys()) {
    if (pressed & (1u << SwitchBit::kNavLeft)) applyApproval(approval.answer(false, approvedApps), nowMs);
    else if (pressed & (1u << SwitchBit::kNavRight)) applyApproval(approval.answer(true, approvedApps), nowMs);
  } else if (pressed & (1u << SwitchBit::kClicker)) {
    applyApproval(approval.answer(true, approvedApps), nowMs);
  }
}

// ---- Modes and commands -----------------------------------------------------

void enterAppMode(uint32_t nowMs) {
  if (game.isRunning()) {
    game.cancel(nowMs);
    recordFinishedGame();
  } else {
    game.cancel(nowMs);  // disarm a game still waiting for its first move
  }
  fidgetMode = FidgetMode::kApp;
  appDisplay = AppDisplay{};
  appResultPending = false;
  goTo(Screen::App, nowMs);
}

// After an app game the toy shows its score like one of its own games, then Free
// Play is ready again while the app stays connected.
void enterStandaloneMode(uint32_t nowMs) {
  fidgetMode = FidgetMode::kStandalone;
  if (appResultPending) {
    appResultPending = false;
    resultScore = appResultScore;
    resultNewBest = appResultNewBest;
    goTo(Screen::Result, nowMs);
    return;
  }
  armGame(nowMs);
}

void sendError(uint8_t code, uint8_t opcode) {
  const ErrorMessage message = makeErrorMessage(code, opcode);
  bleSendMessage(&message, sizeof(message));
}

void handleCommand(const CommandBytes& bytes, uint32_t nowMs) {
  ParsedCommand command;
  const uint8_t error = parseCommand(bytes.data, bytes.length, command);
  if (error != ErrorCode::kNone) {
    sendError(error, bytes.length > 0 ? bytes.data[0] : 0);
    return;
  }
  if (command.opcode == CommandOpcode::kHello) {
    applyApproval(approval.onHello(command.appId, command.name, nowMs, approvedApps), nowMs);
    return;
  }
  if (!approval.approved()) {
    sendError(ErrorCode::kNotApproved, command.opcode);
    return;
  }
  // The toy owns its screen in standalone mode; display commands only apply in app mode.
  const bool appOwnsScreen = fidgetMode == FidgetMode::kApp;

  switch (command.opcode) {
    case CommandOpcode::kSetTime:
      clockSet = true;
      clockUnixAtSet = command.unixSeconds;
      clockMillisAtSet = nowMs;
      break;
    case CommandOpcode::kSetMode:
      if (command.mode == FidgetMode::kApp && fidgetMode != FidgetMode::kApp) enterAppMode(nowMs);
      if (command.mode == FidgetMode::kStandalone && fidgetMode != FidgetMode::kStandalone) enterStandaloneMode(nowMs);
      break;
    case CommandOpcode::kHaptic:
      hapticsPlay(command.effects, command.effectCount);
      break;
    case CommandOpcode::kScoreEvent:
      // An app game's moment: same animation and haptic as the toy's own games.
      celebrate(command.kind, command.score, command.value, nowMs,
                command.kind == ScoreEventKind::kGameEnd && command.score > command.value);
      if (command.kind == ScoreEventKind::kGameEnd && fidgetMode == FidgetMode::kApp) {
        appResultPending = command.score > 0;  // no "0 points" screen, as for the toy's games
        appResultScore = command.score;
        appResultNewBest = command.score > command.value;
      }
      break;
    case CommandOpcode::kShowText:
      if (!appOwnsScreen) break;
      memcpy(appDisplay.lines[command.line], command.text, sizeof(appDisplay.lines[0]));
      appDisplay.showScore = false;
      redraw = true;
      break;
    case CommandOpcode::kShowScore:
      if (!appOwnsScreen) break;
      appDisplay.showScore = true;
      appDisplay.score = command.score;
      appDisplay.best = command.best;
      appDisplay.stars = command.stars;
      redraw = true;
      break;
    case CommandOpcode::kShowProgress:
      if (!appOwnsScreen) break;
      appDisplay.showScore = false;
      appDisplay.showProgress = true;
      appDisplay.percent = command.percent;
      memcpy(appDisplay.label, command.label, sizeof(appDisplay.label));
      redraw = true;
      break;
    case CommandOpcode::kClearDisplay:
      if (!appOwnsScreen) break;
      appDisplay = AppDisplay{};
      redraw = true;
      break;
    case CommandOpcode::kSyncRequest:
      sendRecordsAfter(command.afterRecordId);
      break;
    case CommandOpcode::kSyncAck:
      scoreLog.ack(command.upToRecordId);
      storageSave(scoreLog);
      break;
    case CommandOpcode::kSetBest:
      scoreLog.raiseBest(command.modeId, command.score);
      storageSave(scoreLog);
      break;
  }
}

// ---- Input ----------------------------------------------------------------

// Reads every part, and gives the hands their feedback straight away: a tap for
// a press, a rumble while the spinner or the screw turns (any mode).
void readInputs(uint32_t nowMs) {
  const RawInputs raw = inputsRead();
  const uint16_t stableBefore = debouncer.stable();
  const uint16_t newlyPressed = debouncer.update(raw.closedSwitches, nowMs);
  pressedForNotify |= newlyPressed;
  pressedForGame |= newlyPressed;
  if (raw.spinnerValid) spinner.update(raw.spinnerRaw);
  if (inputsStarted && inputTaps(stableBefore, debouncer.stable())) hapticsTap();
  hapticsUpdate(rumble.update(spinner.total(), raw.screwDetents, nowMs), nowMs);
  inputsStarted = true;

  const bool awaitingApproval = approval.state() == ConnectionApproval::State::kWaitingForHello || approval.asking();
  current.mode = fidgetMode;
  current.switches = debouncer.stable();
  current.spinnerTotal = spinner.total();
  current.screwTotal = static_cast<int16_t>(raw.screwDetents);
  current.reserved = 0;
  current.timeMs = static_cast<uint16_t>(nowMs);
  current.batteryPercent = batteryPercent();
  current.flags = (clockSet ? InputFlag::kClockSet : 0) | (batteryCharging() ? InputFlag::kCharging : 0) |
                  (game.isRunning() ? InputFlag::kStandaloneGame : 0) |
                  (awaitingApproval ? InputFlag::kAwaitingApproval : 0);
}

bool inputChangedSinceLastSend() {
  return current.mode != lastSent.mode || current.switches != lastSent.switches ||
         current.spinnerTotal != lastSent.spinnerTotal || current.screwTotal != lastSent.screwTotal ||
         current.flags != lastSent.flags || current.batteryPercent != lastSent.batteryPercent ||
         pressedForNotify != 0;
}

// Sends an input packet on change (at most every 20 ms) and at least once a
// second. Only an approved phone gets notifications.
void publishInput(uint32_t nowMs) {
  const uint32_t sinceLast = nowMs - lastNotifyMs;
  const bool due = sentOnce ? (inputChangedSinceLastSend() && sinceLast >= kMinNotifyGapMs) || sinceLast >= kHeartbeatMs
                            : true;
  if (!due) return;
  current.seq = sentOnce ? static_cast<uint8_t>(lastSent.seq + 1) : 0;
  current.pressed = pressedForNotify;
  pressedForNotify = 0;
  bleSetInput(current, approval.approved());
  lastSent = current;
  sentOnce = true;
  lastNotifyMs = nowMs;
}

// ---- Standalone play --------------------------------------------------------

// Holding both menu keys for 5 s on Ready forgets every approved phone.
bool checkForgetPhones(uint32_t nowMs) {
  if ((debouncer.stable() & kNavBits) != kNavBits) {
    bothMenuKeysSinceMs = 0;
    return false;
  }
  if (bothMenuKeysSinceMs == 0) bothMenuKeysSinceMs = nowMs;
  if (nowMs - bothMenuKeysSinceMs < kForgetPhonesHoldMs) return false;
  bothMenuKeysSinceMs = 0;
  approvedApps.clear();
  storageSaveApprovedApps(approvedApps);
  noticeText = "FORGOT ALL\nPHONES";
  goTo(Screen::Notice, nowMs);
  return true;
}

void updateStandalone(uint32_t nowMs) {
  const bool pressed = pressedForGame != 0;
  const uint32_t elapsed = nowMs - screenStartMs;

  switch (screen) {
    case Screen::Boot:
      if (elapsed >= BootAnimation::kTotalMs || pressed) goTo(Screen::Welcome, nowMs);  // a press skips ahead
      break;
    case Screen::Welcome:
      if (elapsed >= kWelcomeMs || pressed) goTo(Screen::Instructions, nowMs);  // a press skips ahead
      break;
    case Screen::Instructions:
      if (elapsed >= kInstructionsMs || pressed) armGame(nowMs);
      break;
    case Screen::Ready: {
      if (checkForgetPhones(nowMs)) break;
      const uint16_t nav = pressedForGame & kMenuBits;
      if (nav) {
        const bool left = (nav & (1u << SwitchBit::kNavLeft)) != 0;
        selectedGame = (selectedGame + (left ? kToyGameCount - 1 : 1)) % kToyGameCount;
        armGame(nowMs);
        break;
      }
      InputPacket forGame = current;
      forGame.pressed = pressedForGame & static_cast<uint16_t>(~kMenuBits);
      game.update(forGame, nowMs);
      if (game.isRunning()) {
        Serial.print(gameTitle(game.modeId()));
        Serial.println(" started");
        emitScoreEvent(scoreEvents.start(scoreLog.best(game.modeId())), nowMs);
        emitScoreChanges(nowMs);  // the first move scores
        goTo(Screen::Playing, nowMs);
      }
      break;
    }
    case Screen::Playing: {
      InputPacket forGame = current;
      forGame.pressed = pressedForGame;
      const uint32_t before = game.score();
      game.update(forGame, nowMs);
      if (game.score() != before) {
        Serial.print("Points: ");
        Serial.println(game.score());
        emitScoreChanges(nowMs);
        redraw = true;
      }
      if (game.isFinished()) {
        graceShown = false;
        recordFinishedGame();
        emitScoreEvent(scoreEvents.end(), nowMs, resultNewBest);
        if (resultScore > 0) goTo(Screen::Result, nowMs);
        else armGame(nowMs);  // no "0 points" screen
        break;
      }
      const bool inGrace = game.graceRemaining(nowMs) >= 0.0f;
      if (inGrace != graceShown) {
        graceShown = inGrace;
        redraw = true;
      }
      break;
    }
    case Screen::Result:
      if (elapsed >= kResultMs) armGame(nowMs);
      break;
    case Screen::Notice:
      if (elapsed >= kNoticeMs) armGame(nowMs);
      break;
    case Screen::App:
      break;
  }
  pressedForGame = 0;
}

// ---- Drawing ----------------------------------------------------------------

void drawScreen(uint32_t nowMs) {
  switch (screen) {
    case Screen::Boot: uiBoot(nowMs - screenStartMs); break;
    case Screen::Welcome: uiWelcome(); break;
    case Screen::Instructions: uiInstructions(); break;
    case Screen::Ready: uiReady(gameTitle(kToyGames[selectedGame]), kToyGameCount > 1, linked); break;
    case Screen::Playing: uiPoints(game.score(), linked, graceShown ? game.graceRemaining(nowMs) : -1.0f); break;
    case Screen::Result: uiResult(resultScore, resultNewBest, nowMs - screenStartMs); break;
    case Screen::Notice: uiNotice(noticeText); break;
    case Screen::App: uiApp(appDisplay); break;
  }
}

void render(uint32_t nowMs) {
  // The "connect?" question beats everything else on screen.
  if (approval.asking()) {
    const uint32_t secondsLeft = approval.secondsLeftToAnswer(nowMs);
    if (!redraw && secondsLeft == promptSecondsShown) return;
    redraw = false;
    promptSecondsShown = secondsLeft;
    uiApprovalPrompt(approval.phoneName(), secondsLeft, inputsHaveMenuKeys());
    uiFlush();
    return;
  }
  if (celebration.active(nowMs)) {
    if (nowMs - lastFrameMs < kAnimationFrameMs && lastFrameMs != 0) return;
    lastFrameMs = nowMs;
    wasAnimating = true;
    const uint32_t elapsed = celebration.elapsedMs(nowMs);
    if (celebration.fullScreen()) {
      uiCelebration(celebration.kind(), celebration.score(), celebration.value(), elapsed);
    } else {
      drawScreen(nowMs);
      uiPointsPop(celebration.value(), elapsed);
    }
    uiFlush();
    return;
  }
  if (wasAnimating) {
    wasAnimating = false;
    redraw = true;
  }
  // The boot animation, the result screen's sparkles and the running-down bar move every frame.
  const bool screenAnimates = screen == Screen::Boot || screen == Screen::Result ||
                              (screen == Screen::Playing && graceShown);
  const uint32_t frameMs = screen == Screen::Boot ? kBootFrameMs : kAnimationFrameMs;
  if (screenAnimates && nowMs - lastScreenFrameMs >= frameMs) redraw = true;
  if (!redraw) return;
  redraw = false;
  lastScreenFrameMs = nowMs;
  drawScreen(nowMs);
  uiFlush();
}

}  // namespace

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(400000);  // every part on the bus does 400 kHz; keeps the polled encoder from missing steps

  inputsBegin();
  if (!uiBegin()) Serial.println("OLED initialization failed!");
  hapticsBegin();
  batteryBegin();
  storageBegin();
  storageLoad(scoreLog);
  storageLoadApprovedApps(approvedApps);

  const uint32_t now = millis();
  readInputs(now);  // debounce baseline
  bleBegin(makeInfo(), current);
  goTo(Screen::Boot, now);
}

void loop() {
  const uint32_t now = millis();

  bool connected = false;
  bool disconnected = false;
  bleTakeLinkEvents(connected, disconnected);
  if (disconnected) {
    Serial.println("Phone disconnected");
    approval.onDisconnect();
    disconnectPending = false;
    redraw = true;
    if (fidgetMode == FidgetMode::kApp) enterStandaloneMode(now);  // never leave a frozen screen
  }
  if (connected) {
    Serial.println("Phone connected");
    approval.onConnect(now);
    pressedForNotify = 0;
  }
  if (bleConnected() != linked) {
    linked = !linked;
    redraw = true;
  }
  applyApproval(approval.update(now), now);
  if (disconnectPending && static_cast<int32_t>(now - disconnectAtMs) >= 0) {
    disconnectPending = false;
    bleDisconnect();
  }

  CommandBytes command;
  while (bleTakeCommand(command)) handleCommand(command, now);
  if (bleTakeDroppedCommand()) sendError(ErrorCode::kBusy, 0);

  batteryUpdate(now);
  readInputs(now);
  if (approval.asking()) {
    answerPrompt(now);
  } else if (fidgetMode == FidgetMode::kStandalone) {
    updateStandalone(now);
  } else {
    pressedForGame = 0;
  }
  publishInput(now);
  render(now);

  delay(2);  // lets the BLE and USB tasks run; inputs are still sampled every few ms
}
