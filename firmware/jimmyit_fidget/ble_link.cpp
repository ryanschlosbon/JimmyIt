#include "ble_link.h"

#include <Arduino.h>
#include <bluefruit.h>

using namespace jimmyit;

namespace {

// BLEUuid keeps a pointer to these arrays, which are static (fidget_protocol.cpp).
BLEService fidgetService(kUuid128Service);
BLECharacteristic inputChar(kUuid128Input);
BLECharacteristic commandChar(kUuid128Command);
BLECharacteristic messageChar(kUuid128Message);
BLECharacteristic infoChar(kUuid128Info);

constexpr UBaseType_t kCommandQueueLength = 8;
QueueHandle_t commandQueue = nullptr;
volatile bool connectPending = false;
volatile bool disconnectPending = false;
volatile bool droppedCommand = false;

void onConnect(uint16_t) { connectPending = true; }

void onDisconnect(uint16_t, uint8_t) { disconnectPending = true; }

// Runs in Bluefruit's callback task, not loop(): only copy the bytes here.
void onCommandWrite(uint16_t, BLECharacteristic*, uint8_t* data, uint16_t length) {
  CommandBytes command = {};
  command.length = static_cast<uint8_t>(length > kMaxPayloadBytes ? kMaxPayloadBytes : length);
  memcpy(command.data, data, command.length);
  if (xQueueSend(commandQueue, &command, 0) != pdTRUE) droppedCommand = true;
}

}  // namespace

void bleBegin(const DeviceInfo& info, const InputPacket& firstInput) {
  commandQueue = xQueueCreate(kCommandQueueLength, sizeof(CommandBytes));

  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("JimmyIt");
  Bluefruit.Periph.setConnectCallback(onConnect);
  Bluefruit.Periph.setDisconnectCallback(onDisconnect);
  Bluefruit.Periph.setConnInterval(12, 24);  // 15-30 ms, in 1.25 ms units

  // Characteristics attach to the service begun most recently.
  fidgetService.begin();

  inputChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
  inputChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  inputChar.setFixedLen(sizeof(InputPacket));
  inputChar.begin();
  inputChar.write(&firstInput, sizeof(firstInput));

  commandChar.setProperties(CHR_PROPS_WRITE | CHR_PROPS_WRITE_WO_RESP);
  commandChar.setPermission(SECMODE_NO_ACCESS, SECMODE_OPEN);
  commandChar.setMaxLen(kMaxPayloadBytes);
  commandChar.setWriteCallback(onCommandWrite);
  commandChar.begin();

  messageChar.setProperties(CHR_PROPS_NOTIFY);
  messageChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  messageChar.setMaxLen(kMaxPayloadBytes);
  messageChar.begin();

  infoChar.setProperties(CHR_PROPS_READ);
  infoChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  infoChar.setFixedLen(sizeof(DeviceInfo));
  infoChar.begin();
  infoChar.write(&info, sizeof(info));

  // Flags + 128-bit service UUID fit the 31-byte advertisement; the name goes in the scan response.
  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addService(fidgetService);
  Bluefruit.ScanResponse.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244);  // fast then slow, in 0.625 ms units
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0);  // advertise until connected
}

bool bleConnected() { return Bluefruit.connected() > 0; }

void bleTakeLinkEvents(bool& connected, bool& disconnected) {
  connected = connectPending;
  disconnected = disconnectPending;
  connectPending = false;
  disconnectPending = false;
}

bool bleTakeCommand(CommandBytes& out) { return commandQueue && xQueueReceive(commandQueue, &out, 0) == pdTRUE; }

bool bleTakeDroppedCommand() {
  const bool dropped = droppedCommand;
  droppedCommand = false;
  return dropped;
}

void bleSetInput(const InputPacket& packet) {
  inputChar.write(&packet, sizeof(packet));
  if (inputChar.notifyEnabled()) inputChar.notify(&packet, sizeof(packet));
}

bool bleSendMessage(const void* data, uint16_t length) {
  if (!messageChar.notifyEnabled()) return false;
  return messageChar.notify(data, length);
}

void bleSetInfo(const DeviceInfo& info) { infoChar.write(&info, sizeof(info)); }
