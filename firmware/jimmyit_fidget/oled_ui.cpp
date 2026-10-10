#include "oled_ui.h"

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <Wire.h>

namespace {

constexpr int kScreenWidth = 128;
constexpr int kScreenHeight = 64;
constexpr int kOledReset = -1;
constexpr uint8_t kScreenAddress = 0x3C;

Adafruit_SSD1306 display(kScreenWidth, kScreenHeight, &Wire, kOledReset);
bool displayOk = false;

// A full-screen message, as in the original showMessage() but without the delay.
void showMessage(const String& message) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(true);
  display.setCursor(0, 10);
  display.println(message);
  display.display();
}

void drawLinkBadge(bool linked) {
  if (!linked) return;
  display.setTextSize(1);
  display.setCursor(116, 0);
  display.print("BT");
}

}  // namespace

bool uiBegin() {
  displayOk = display.begin(SSD1306_SWITCHCAPVCC, kScreenAddress);
  return displayOk;
}

void uiWelcome() {
  if (displayOk) showMessage("WELCOME TO KNIGHT HACKS!\n\nFIDGET QUEST");
}

void uiInstructions() {
  if (displayOk) showMessage("DRAW SHAPES, LETTERS, AND NUMBERS TO EARN POINTS!");
}

void uiCountdown(uint8_t number) {
  if (!displayOk) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(30, 5);
  display.println("READY");
  display.setTextSize(3);
  display.setCursor(55, 30);
  display.println(number);
  display.display();
}

void uiPoints(uint32_t points, bool linked) {
  if (!displayOk) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(20, 0);
  display.println("FIDGET QUEST");
  drawLinkBadge(linked);
  display.drawLine(0, 13, 127, 13, SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(10, 24);
  display.print(points);
  display.println(" PTS");

  display.setTextSize(1);
  display.setCursor(22, 54);
  display.println("KEEP PLAYING!");
  display.display();
}

void uiAchievement(uint32_t points) {
  if (displayOk) showMessage("AMAZING JOB!\n\nYOU REACHED " + String(points) + " POINTS!");
}

void uiResult(uint32_t points, bool newBest) {
  if (!displayOk) return;
  String message = "GREAT PLAYING!\n\nYOU SCORED " + String(points) + " POINTS!";
  if (newBest) message += "\n\nNEW BEST!";
  showMessage(message);
}

void uiPressToPlay(bool linked) {
  if (!displayOk) return;
  showMessage("PRESS THE BUTTON\nTO PLAY AGAIN!");
  drawLinkBadge(linked);
  display.display();
}

void uiApp(const AppDisplay& app) {
  if (!displayOk) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(false);
  drawLinkBadge(true);

  if (app.showScore) {
    display.setTextSize(1);
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
    display.display();
    return;
  }

  bool anything = false;
  display.setTextSize(1);
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
  display.display();
}
