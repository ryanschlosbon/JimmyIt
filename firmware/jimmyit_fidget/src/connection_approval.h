// "Connect to <phone>?" on the toy (PROTOCOL.md "Connecting"). Pure logic: the
// sketch feeds it Bluetooth events, button answers and millis(), and carries out
// the Action it returns.
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "fidget_protocol.h"

namespace jimmyit {

// Phones the child has said yes to, so they aren't asked again. Most recent first.
class ApprovedApps {
 public:
  static constexpr size_t kCapacity = 8;
  static constexpr size_t kSerializedBytes = 1 + 1 + 4 * kCapacity;

  bool contains(uint32_t appId) const;
  // Adds (or moves to the front); the least recently approved drops off when full.
  void remember(uint32_t appId);
  void clear() { count_ = 0; }
  size_t count() const { return count_; }

  void serialize(uint8_t* out) const;
  bool deserialize(const uint8_t* in, size_t length);

 private:
  uint32_t ids_[kCapacity] = {};
  size_t count_ = 0;
};

class ConnectionApproval {
 public:
  static constexpr uint32_t kHelloWaitMs = 2000;  // then ask about "A PHONE"
  static constexpr uint32_t kAnswerTimeoutMs = 30000;  // no answer = no

  enum class State : uint8_t { kNoPhone, kWaitingForHello, kAsking, kApproved };

  enum class Action : uint8_t {
    kNone,
    kSendWaiting,                // approval(waiting); show the question
    kSendAccepted,               // approval(accepted)
    kSendDeclinedAndDisconnect,  // approval(declined), then drop the link
  };

  void onConnect(uint32_t nowMs);
  void onDisconnect();
  Action onHello(uint32_t appId, const char* name, uint32_t nowMs, ApprovedApps& approved);
  // Call every loop: handles the hello wait and the answer timeout.
  Action update(uint32_t nowMs);
  // The child's answer while asking. Remembers the phone on yes.
  Action answer(bool yes, ApprovedApps& approved);

  State state() const { return state_; }
  bool approved() const { return state_ == State::kApproved; }
  bool asking() const { return state_ == State::kAsking; }
  // Name to show in the question, uppercase ASCII.
  const char* phoneName() const { return name_; }
  uint32_t secondsLeftToAnswer(uint32_t nowMs) const;

 private:
  void startAsking(uint32_t nowMs);

  State state_ = State::kNoPhone;
  uint32_t sinceMs_ = 0;
  uint32_t appId_ = 0;
  bool hasAppId_ = false;
  char name_[kMaxAppNameLength + 1] = "A PHONE";
};

}  // namespace jimmyit
