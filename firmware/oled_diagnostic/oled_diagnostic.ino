#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <Wire.h>

constexpr uint8_t kOledAddressA = 0x3C;
constexpr uint8_t kOledAddressB = 0x3D;
Adafruit_SSD1306 display(128, 64, &Wire, -1, 100000UL, 100000UL);
uint8_t oledAddress = 0;
bool displayReady = false;
uint32_t lastReportMs = 0;
uint32_t frame = 0;

bool responds(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(100000);

  for (uint8_t address = 1; address < 127; address++) {
    if (responds(address)) {
      Serial.print("I2C device at 0x");
      Serial.println(address, HEX);
    }
  }

  if (responds(kOledAddressA)) oledAddress = kOledAddressA;
  else if (responds(kOledAddressB)) oledAddress = kOledAddressB;
  if (oledAddress != 0) displayReady = display.begin(SSD1306_SWITCHCAPVCC, oledAddress);
}

void loop() {
  const uint32_t nowMs = millis();
  if (nowMs - lastReportMs < 1000) return;
  lastReportMs = nowMs;

  Serial.print("OLED address: 0x");
  Serial.print(oledAddress, HEX);
  Serial.print(" ACK: ");
  Serial.print(oledAddress != 0 && responds(oledAddress) ? "yes" : "no");
  Serial.print(" buffer: ");
  Serial.println(displayReady ? "yes" : "no");

  if (!displayReady) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(4, 4);
  display.print("JIMMY OLED TEST");
  display.drawRect(0, 0, 128, 64, SSD1306_WHITE);
  display.fillRect(8 + (frame % 12) * 9, 28, 8, 8, SSD1306_WHITE);
  display.setCursor(4, 48);
  display.print("FRAME ");
  display.print(frame++);
  display.display();
}
