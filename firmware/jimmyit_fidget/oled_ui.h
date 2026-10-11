// Every OLED screen. The standalone screens keep the original breadboard
// sketch's text and layout. Functions draw into the frame buffer; call
// uiFlush() once per frame to send it to the display.
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
void uiFlush();

// The selected toy game, waiting for the child's first move.
void uiReady(const char* gameTitle, bool showMenuHint, bool linked);
// graceRemaining: 1 → 0 while the game is about to end for lack of a move (a bar
// runs down); negative while play is going on ("KEEP PLAYING!").
void uiPoints(uint32_t points, bool linked, float graceRemaining);
// The final score with sparkles (and "NEW BEST!"); redraw it every frame.
// The boot animation (src/boot_animation.cpp): the wordmark, Jimmy rolling in and away with his stripes.
void uiBoot(uint32_t elapsedMs);
void uiResult(uint32_t points, bool newBest, uint32_t elapsedMs);
void uiApp(const AppDisplay& app);
// "CONNECT TO <NAME>?" with the menu-key answers (or "CLICK = YES" without them).
void uiApprovalPrompt(const char* phoneName, uint32_t secondsLeft, bool hasMenuKeys);
// A short full-screen notice, e.g. "FORGOT ALL PHONES".
void uiNotice(const char* text);

// Score-event animation frames (PROTOCOL.md "Score events").
void uiCelebration(uint8_t kind, uint32_t score, uint32_t value, uint32_t elapsedMs);
// "+N" pop drawn over whatever screen is underneath.
void uiPointsPop(uint32_t points, uint32_t elapsedMs);
