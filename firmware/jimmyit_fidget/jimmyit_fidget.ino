// JimmyIt fidget firmware. Board: "Seeed nRF52 Boards" > "Seeed XIAO nRF52840".
//
// Grew out of the KnightHacks breadboard sketch "Fidget Quest": same screens and
// +10-points-per-press game, now non-blocking, saved to flash, and talking to the
// app over Bluetooth (spec: packages/protocol/PROTOCOL.md).
//
// Files: board_config.h (what is wired up), hardware_inputs (reading parts),
// oled_ui (screens), ble_link (Bluetooth), haptics, score_storage (flash).
// Logic that can run on a laptop is in src/ and tested by `npm run test:firmware`.

#include <Arduino.h>
#include <Wire.h>

#include "ble_link.h"
#include "board_config.h"
#include "hardware_inputs.h"
#include "haptics.h"
#include "oled_ui.h"
#include "score_storage.h"
#include "src/basic_modes.h"
#include "src/fidget_protocol.h"
#include "src/input_helpers.h"
#include "src/score_log.h"

using namespace jimmyit;

enum class Screen : uint8_t { Welcome, Instructions, Countdown, Playing, Achievement, Result, PressToPlay, App };

constexpr uint32_t kWelcomeMs = 5000;
constexpr uint32_t kInstructionsMs = 10000;
constexpr uint32_t kCountdownStepMs = 1000;
constexpr uint8_t kCountdownFrom = 3;
constexpr uint32_t kAchievementMs = 2000;
constexpr uint32_t kResultMs = 4000;
constexpr uint32_t kPointsPerAchievement = 100;
constexpr uint32_t kMinNotifyGapMs = 20;  // at most 50 input notifications a second
constexpr uint32_t kHeartbeatMs = 1000;
constexpr uint8_t kStandaloneGame = BasicModeId::kFreePlay;

namespace {

Screen screen = Screen::Welcome;
uint32_t screenStartMs = 0;
bool redraw = true;
uint8_t countdownShown = 0;
bool linked = false;

uint8_t fidgetMode = FidgetMode::kStandalone;
ScoreLog scoreLog;
BasicGame game;
uint32_t achievementsShown = 0;
uint32_t resultScore = 0;
bool resultNewBest = false;
AppDisplay appDisplay = {};

SwitchDebouncer debouncer(kDebounceMs);
SpinnerTracker spinner;
InputPacket current = {};
InputPacket lastSent = {};
bool sentOnce = false;
uint16_t pressedForNotify = 0;  // presses not yet reported to the app
uint16_t pressedForGame = 0;    // presses not yet given to the game
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
                      (hapticsAvailable() ? Capability::kHaptics : 0);
  info.newestRecordId = scoreLog.newestRecordId();
  info.storedRecordCount = static_cast<uint16_t>(scoreLog.count());
  return info;
}

void goTo(Screen next, uint32_t nowMs) {
  screen = next;
  screenStartMs = nowMs;
  countdownShown = 0;
  redraw = true;
}

// ---- Scores ---------------------------------------------------------------

void startGame(uint32_t nowMs) {
  game.start(kStandaloneGame, nowMs, clockSet ? unixNow(nowMs) : nowMs / 1000, clockSet);
  pressedForGame = 0;
  achievementsShown = 0;
  Serial.println("Game started");
  goTo(Screen::Playing, nowMs);
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

// ---- Modes and commands -----------------------------------------------------

void enterAppMode(uint32_t nowMs) {
  if (game.isRunning()) {
    game.cancel(nowMs);
    recordFinishedGame();
  }
  fidgetMode = FidgetMode::kApp;
  appDisplay = AppDisplay{};
  goTo(Screen::App, nowMs);
}

void enterStandaloneMode(uint32_t nowMs) {
  fidgetMode = FidgetMode::kStandalone;
  goTo(Screen::PressToPlay, nowMs);
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

void readInputs(uint32_t nowMs) {
  const RawInputs raw = inputsRead();
  const uint16_t newlyPressed = debouncer.update(raw.closedSwitches, nowMs);
  pressedForNotify |= newlyPressed;
  pressedForGame |= newlyPressed;
  if (raw.spinnerValid) spinner.update(raw.spinnerRaw);

  current.mode = fidgetMode;
  current.switches = debouncer.stable();
  current.spinnerTotal = spinner.total();
  current.screwTotal = static_cast<int16_t>(raw.screwDetents);
  current.squeezeRaw = raw.squeezeRaw;
  current.timeMs = static_cast<uint16_t>(nowMs);
  current.batteryPercent = kBatteryUnknown;  // TODO: read VBAT once the cell is fitted
  current.flags = (clockSet ? InputFlag::kClockSet : 0) | (game.isRunning() ? InputFlag::kStandaloneGame : 0);
}

bool inputChangedSinceLastSend() {
  return current.mode != lastSent.mode || current.switches != lastSent.switches ||
         current.spinnerTotal != lastSent.spinnerTotal || current.screwTotal != lastSent.screwTotal ||
         current.squeezeRaw != lastSent.squeezeRaw || current.flags != lastSent.flags ||
         current.batteryPercent != lastSent.batteryPercent || pressedForNotify != 0;
}

// Sends an input packet on change (at most every 20 ms) and at least once a second.
void publishInput(uint32_t nowMs) {
  const uint32_t sinceLast = nowMs - lastNotifyMs;
  const bool due = sentOnce ? (inputChangedSinceLastSend() && sinceLast >= kMinNotifyGapMs) || sinceLast >= kHeartbeatMs
                            : true;
  if (!due) return;
  current.seq = sentOnce ? static_cast<uint8_t>(lastSent.seq + 1) : 0;
  current.pressed = pressedForNotify;
  pressedForNotify = 0;
  bleSetInput(current);
  lastSent = current;
  sentOnce = true;
  lastNotifyMs = nowMs;
}

// ---- Standalone play --------------------------------------------------------

void updateStandalone(uint32_t nowMs) {
  const bool pressed = pressedForGame != 0;
  const uint32_t elapsed = nowMs - screenStartMs;

  switch (screen) {
    case Screen::Welcome:
      if (elapsed >= kWelcomeMs || pressed) goTo(Screen::Instructions, nowMs);  // a press skips ahead
      break;
    case Screen::Instructions:
      if (elapsed >= kInstructionsMs || pressed) goTo(Screen::Countdown, nowMs);
      break;
    case Screen::Countdown: {
      if (elapsed >= kCountdownFrom * kCountdownStepMs) {
        startGame(nowMs);
        break;
      }
      const uint8_t number = static_cast<uint8_t>(kCountdownFrom - elapsed / kCountdownStepMs);
      if (number != countdownShown) {
        countdownShown = number;
        redraw = true;
      }
      break;
    }
    case Screen::Playing:
    case Screen::Achievement: {
      InputPacket forGame = current;
      forGame.pressed = pressedForGame;
      const uint32_t before = game.score();
      game.update(forGame, nowMs);
      if (game.score() != before) {
        Serial.print("Points: ");
        Serial.println(game.score());
        if (screen == Screen::Playing) redraw = true;
      }
      if (game.isFinished()) {
        recordFinishedGame();
        if (resultNewBest) hapticsPlay(kCelebrateEffects, sizeof(kCelebrateEffects));
        goTo(resultScore > 0 ? Screen::Result : Screen::PressToPlay, nowMs);  // no "0 points" screen
        break;
      }
      const uint32_t reached = game.score() / kPointsPerAchievement;
      if (reached > achievementsShown) {
        achievementsShown = reached;
        hapticsPlay(kCelebrateEffects, sizeof(kCelebrateEffects));
        goTo(Screen::Achievement, nowMs);
      } else if (screen == Screen::Achievement && elapsed >= kAchievementMs) {
        goTo(Screen::Playing, nowMs);
      }
      break;
    }
    case Screen::Result:
      if (elapsed >= kResultMs) goTo(Screen::PressToPlay, nowMs);
      break;
    case Screen::PressToPlay:
      if (pressed) goTo(Screen::Countdown, nowMs);
      break;
    case Screen::App:
      break;
  }
  pressedForGame = 0;
}

void render() {
  if (!redraw) return;
  redraw = false;
  switch (screen) {
    case Screen::Welcome: uiWelcome(); break;
    case Screen::Instructions: uiInstructions(); break;
    case Screen::Countdown: uiCountdown(countdownShown > 0 ? countdownShown : kCountdownFrom); break;
    case Screen::Playing: uiPoints(game.score(), linked); break;
    case Screen::Achievement: uiAchievement(game.score()); break;
    case Screen::Result: uiResult(resultScore, resultNewBest); break;
    case Screen::PressToPlay: uiPressToPlay(linked); break;
    case Screen::App: uiApp(appDisplay); break;
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  Wire.begin();

  inputsBegin();
  if (!uiBegin()) Serial.println("OLED initialization failed!");
  hapticsBegin();
  storageBegin();
  storageLoad(scoreLog);

  const uint32_t now = millis();
  readInputs(now);  // debounce baseline
  bleBegin(makeInfo(), current);
  goTo(Screen::Welcome, now);
}

void loop() {
  const uint32_t now = millis();

  bool connected = false;
  bool disconnected = false;
  bleTakeLinkEvents(connected, disconnected);
  if (connected) {
    Serial.println("App connected");
    pressedForNotify = 0;
  }
  if (disconnected) {
    Serial.println("App disconnected");
    if (fidgetMode == FidgetMode::kApp) enterStandaloneMode(now);  // never leave a frozen screen
  }
  if (bleConnected() != linked) {
    linked = !linked;
    redraw = true;
  }

  CommandBytes command;
  while (bleTakeCommand(command)) handleCommand(command, now);
  if (bleTakeDroppedCommand()) sendError(ErrorCode::kBusy, 0);

  readInputs(now);
  if (fidgetMode == FidgetMode::kStandalone) {
    updateStandalone(now);
  } else {
    pressedForGame = 0;
  }
  publishInput(now);
  render();

  delay(2);  // lets the BLE and USB tasks run; inputs are still sampled every few ms
}
