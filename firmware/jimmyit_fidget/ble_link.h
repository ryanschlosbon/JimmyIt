// Bluetooth side of the protocol: the GATT service, advertising, and a queue
// that moves command writes from the BLE task into loop().
#pragma once

#include <stdint.h>

#include "src/fidget_protocol.h"

struct CommandBytes {
  uint8_t length;
  uint8_t data[jimmyit::kMaxPayloadBytes];
};

void bleBegin(const jimmyit::DeviceInfo& info, const jimmyit::InputPacket& firstInput);
bool bleConnected();
// Link changes since the last call. Each flag is true at most once per event.
void bleTakeLinkEvents(bool& connected, bool& disconnected);
// Next command written by the app, if any. Call from loop() only.
bool bleTakeCommand(CommandBytes& out);
// True once after a command was dropped because the queue was full.
bool bleTakeDroppedCommand();
// Updates the `input` value for reads and notifies it if the app subscribed.
void bleSetInput(const jimmyit::InputPacket& packet);
// Notifies one `message`. Returns false if nobody is subscribed or it failed.
bool bleSendMessage(const void* data, uint16_t length);
void bleSetInfo(const jimmyit::DeviceInfo& info);
