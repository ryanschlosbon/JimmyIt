#include <Adafruit_GFX.h>
#include <Adafruit_LittleFS.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <InternalFileSystem.h>
#include <Wire.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1, 100000UL, 100000UL);

void showStatus(const char* message) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 20);
  display.println(message);
  display.display();
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(100000);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C, true, false);
  showStatus("WIPING FLASH...");

  InternalFS.begin();
  const bool formatted = InternalFS.format();
  const bool mounted = formatted && InternalFS.begin();
  if (mounted) {
    showStatus("FLASH WIPED\nREADY TO REFLASH");
    Serial.println("FLASH WIPED");
  } else {
    showStatus("FLASH WIPE FAILED");
    Serial.println("FLASH WIPE FAILED");
  }
}

void loop() {}
