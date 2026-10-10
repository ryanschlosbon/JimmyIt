#include "oled_ui.h"

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <Wire.h>
#include <string.h>

namespace {

constexpr int kScreenWidth = 128;
constexpr int kScreenHeight = 64;
constexpr int kOledReset = -1;
constexpr uint8_t kScreenAddress = 0x3C;

Adafruit_SSD1306 display(kScreenWidth, kScreenHeight, &Wire, kOledReset);
bool displayOk = false;

void begin() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(true);
  display.setTextSize(1);
}

// A full-screen message, as in the original showMessage() but without the delay.
void showMessage(const String& message) {
  begin();
  display.setCursor(0, 10);
  display.println(message);
}

void header(bool linked) {
  display.setTextSize(1);
  display.setCursor(20, 0);
  display.println("FIDGET QUEST");
  if (linked) {
    display.setCursor(116, 0);
    display.print("BT");
  }
  display.drawLine(0, 13, 127, 13, SSD1306_WHITE);
}

void centered(const char* text, uint8_t size, int16_t y) {
  display.setTextSize(size);
  const int16_t width = static_cast<int16_t>(strlen(text) * 6 * size);
  display.setCursor(width < kScreenWidth ? (kScreenWidth - width) / 2 : 0, y);
  display.print(text);
}

// Tiny deterministic sparkle positions: same frame, same picture.
uint32_t nextRandom(uint32_t& seed) {
  seed = seed * 1664525u + 1013904223u;
  return seed >> 8;
}

void sparkles(uint32_t frame, uint8_t count) {
  uint32_t seed = frame * 2654435761u + 1;
  for (uint8_t i = 0; i < count; i++) {
    const int16_t x = static_cast<int16_t>(nextRandom(seed) % kScreenWidth);
    const int16_t y = static_cast<int16_t>(nextRandom(seed) % kScreenHeight);
    display.drawPixel(x, y, SSD1306_WHITE);
    display.drawPixel(x - 1, y, SSD1306_WHITE);
    display.drawPixel(x + 1, y, SSD1306_WHITE);
    display.drawPixel(x, y - 1, SSD1306_WHITE);
    display.drawPixel(x, y + 1, SSD1306_WHITE);
  }
}

}  // namespace

bool uiBegin() {
  displayOk = display.begin(SSD1306_SWITCHCAPVCC, kScreenAddress);
  return displayOk;
}

void uiFlush() {
  if (displayOk) display.display();
}

void uiWelcome() { showMessage("WELCOME TO KNIGHT HACKS!\n\nFIDGET QUEST"); }

void uiInstructions() { showMessage("DRAW SHAPES, LETTERS, AND NUMBERS TO EARN POINTS!"); }

void uiReady(const char* gameTitle, bool showMenuHint, bool linked) {
  begin();
  display.setTextWrap(false);
  header(linked);
  centered(gameTitle, 2, 22);
  display.setTextSize(1);
  display.setCursor(1, 44);
  display.println("MAKE A MOVE TO START!");
  if (showMenuHint) {
    display.setCursor(4, 55);
    display.println("< NAV: CHANGE GAME >");
  }
}

void uiPoints(uint32_t points, bool linked, int32_t secondsLeft) {
  begin();
  header(linked);
  display.setTextSize(2);
  display.setCursor(10, 24);
  display.print(points);
  display.println(" PTS");
  display.setTextSize(1);
  if (secondsLeft >= 0) {
    display.setCursor(28, 54);
    display.print("TIME LEFT: ");
    display.print(secondsLeft);
  } else {
    display.setCursor(22, 54);
    display.println("KEEP PLAYING!");
  }
}

void uiResult(uint32_t points, bool newBest) {
  String message = "GREAT PLAYING!\n\nYOU SCORED " + String(points) + " POINTS!";
  if (newBest) message += "\n\nNEW BEST!";
  showMessage(message);
}

void uiApp(const AppDisplay& app) {
  begin();
  display.setTextWrap(false);
  display.setCursor(116, 0);
  display.print("BT");

  if (app.showScore) {
    display.setCursor(0, 0);
    display.println("SCORE");
    display.drawLine(0, 13, 127, 13, SSD1306_WHITE);
    display.setTextSize(2);
    display.setCursor(10, 22);
    display.print(app.score);
    display.println(" PTS");
    display.setTextSize(1);
    display.setCursor(0, 54);
    if (app.best > 0) {
      display.print("BEST ");
      display.print(app.best);
    }
    display.setCursor(104, 54);
    for (uint8_t i = 0; i < 3; i++) display.print(i < app.stars ? '*' : '.');
    return;
  }

  bool anything = false;
  for (uint8_t i = 0; i < jimmyit::kDisplayLineCount; i++) {
    if (app.lines[i][0] == '\0') continue;
    anything = true;
    display.setCursor(0, 2 + i * 10);
    display.print(app.lines[i]);
  }
  if (app.showProgress) {
    anything = true;
    display.setCursor(0, 42);
    display.print(app.label);
    display.drawRect(0, 53, 128, 10, SSD1306_WHITE);
    display.fillRect(2, 55, (124 * app.percent) / 100, 6, SSD1306_WHITE);
  }
  if (!anything) {
    display.setCursor(16, 28);
    display.print("CONNECTED TO APP");
  }
}

void uiApprovalPrompt(const char* phoneName, uint32_t secondsLeft, bool hasMenuKeys) {
  begin();
  display.setTextWrap(false);
  centered("CONNECT TO", 1, 2);
  centered(phoneName, 1, 16);
  centered("?", 2, 26);
  display.drawLine(0, 44, 127, 44, SSD1306_WHITE);
  display.setTextSize(1);
  if (hasMenuKeys) {
    display.setCursor(2, 52);
    display.print("< NO");
    display.setCursor(98, 52);
    display.print("YES >");
  } else {
    centered("CLICK = YES", 1, 50);
  }
  display.setCursor(58, 52);
  display.print(secondsLeft);
}

void uiNotice(const char* text) { showMessage(text); }

void uiCelebration(uint8_t kind, uint32_t score, uint32_t value, uint32_t elapsedMs) {
  begin();
  display.setTextWrap(false);
  const uint32_t frame = elapsedMs / 120;
  char line[24];
  switch (kind) {
    case jimmyit::ScoreEventKind::kGameStart: {
      // "GO!" grows while rays burst out from the middle.
      const uint8_t size = static_cast<uint8_t>(2 + (elapsedMs > 300 ? 2 : elapsedMs / 150));
      const int16_t ray = static_cast<int16_t>(10 + elapsedMs / 12);
      for (int16_t i = 0; i < 8; i++) {
        const float angle = i * 0.785398f;
        display.drawLine(64 + static_cast<int16_t>(cosf(angle) * (ray - 8)), 32 + static_cast<int16_t>(sinf(angle) * (ray - 8)),
                         64 + static_cast<int16_t>(cosf(angle) * ray), 32 + static_cast<int16_t>(sinf(angle) * ray), SSD1306_WHITE);
      }
      centered("GO!", size, static_cast<int16_t>(32 - size * 4));
      break;
    }
    case jimmyit::ScoreEventKind::kMilestone:
      sparkles(frame, 14);
      centered("AMAZING JOB!", 1, 6);
      snprintf(line, sizeof(line), "%lu", static_cast<unsigned long>(value));
      centered(line, 3, 22);
      centered("POINTS!", 1, 52);
      break;
    case jimmyit::ScoreEventKind::kNewBest: {
      // Rings ripple out from the middle; the text flashes in and out of a solid box.
      for (int16_t r = static_cast<int16_t>((elapsedMs / 25) % 24); r < 80; r += 24) {
        display.drawCircle(64, 32, r, SSD1306_WHITE);
      }
      const bool solid = (frame / 2) % 2 == 0;
      display.fillRect(8, 12, 112, 40, solid ? SSD1306_WHITE : SSD1306_BLACK);
      display.drawRect(8, 12, 112, 40, SSD1306_WHITE);
      display.setTextColor(solid ? SSD1306_BLACK : SSD1306_WHITE);
      centered("NEW HIGH SCORE!", 1, 16);
      snprintf(line, sizeof(line), "%lu", static_cast<unsigned long>(score));
      centered(line, 2, 27);
      snprintf(line, sizeof(line), "BEAT %lu", static_cast<unsigned long>(value));
      centered(line, 1, 43);
      display.setTextColor(SSD1306_WHITE);
      break;
    }
    default:
      break;
  }
}

void uiPointsPop(uint32_t points, uint32_t elapsedMs) {
  char text[12];
  snprintf(text, sizeof(text), "+%lu", static_cast<unsigned long>(points));
  const int16_t width = static_cast<int16_t>(strlen(text) * 6 + 4);
  const int16_t y = static_cast<int16_t>(16 - static_cast<int16_t>(elapsedMs / 50));  // floats up
  display.fillRect(kScreenWidth - width - 1, y - 1, width, 10, SSD1306_BLACK);
  display.drawRect(kScreenWidth - width - 1, y - 1, width, 10, SSD1306_WHITE);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(kScreenWidth - width + 1, y);
  display.print(text);
}
