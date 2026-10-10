// Every OLED screen. The standalone screens keep the original breadboard
// sketch's text and layout.
#pragma once

#include <stdint.h>

#include "src/fidget_protocol.h"

// What the app has asked the toy to show (app mode only).
struct AppDisplay {
  char lines[jimmyit::kDisplayLineCount][jimmyit::kMaxTextLength + 1];
  bool showScore;
  uint32_t score;
  uint32_t best;
  uint8_t stars;
  bool showProgress;
  uint8_t percent;
  char label[jimmyit::kMaxTextLength + 1];
};

// Returns false if the SSD1306 did not answer; the toy keeps running without it.
bool uiBegin();

void uiWelcome();
void uiInstructions();
void uiCountdown(uint8_t number);
void uiPoints(uint32_t points, bool linked);
void uiAchievement(uint32_t points);
void uiResult(uint32_t points, bool newBest);
void uiPressToPlay(bool linked);
void uiApp(const AppDisplay& app);
