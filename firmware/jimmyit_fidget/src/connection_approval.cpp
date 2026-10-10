#include "connection_approval.h"

#include <string.h>

namespace jimmyit {

namespace {
constexpr uint8_t kApprovedFormatVersion = 1;
constexpr const char* kUnknownPhone = "A PHONE";

void setName(char* out, const char* name) {
  size_t n = 0;
  for (; name[n] != '\0' && n < kMaxAppNameLength; n++) {
    const char c = name[n];
    out[n] = (c >= 'a' && c <= 'z') ? static_cast<char>(c - 'a' + 'A') : c;
  }
  out[n] = '\0';
  if (n == 0) setName(out, kUnknownPhone);
}
}  // namespace

bool ApprovedApps::contains(uint32_t appId) const {
  for (size_t i = 0; i < count_; i++) {
    if (ids_[i] == appId) return true;
  }
  return false;
}

void ApprovedApps::remember(uint32_t appId) {
  size_t at = count_ < kCapacity ? count_ : kCapacity - 1;  // drop the oldest when full
  for (size_t i = 0; i < count_; i++) {
    if (ids_[i] == appId) {
      at = i;
      break;
    }
  }
  for (size_t i = at; i > 0; i--) ids_[i] = ids_[i - 1];
  ids_[0] = appId;
  if (at == count_ && count_ < kCapacity) count_++;
}

void ApprovedApps::serialize(uint8_t* out) const {
  out[0] = kApprovedFormatVersion;
  out[1] = static_cast<uint8_t>(count_);
  memcpy(out + 2, ids_, sizeof(ids_));
}

bool ApprovedApps::deserialize(const uint8_t* in, size_t length) {
  clear();
  if (length != kSerializedBytes || in[0] != kApprovedFormatVersion || in[1] > kCapacity) return false;
  memcpy(ids_, in + 2, sizeof(ids_));
  count_ = in[1];
  return true;
}

void ConnectionApproval::onConnect(uint32_t nowMs) {
  state_ = State::kWaitingForHello;
  sinceMs_ = nowMs;
  hasAppId_ = false;
  setName(name_, kUnknownPhone);
}

void ConnectionApproval::onDisconnect() { state_ = State::kNoPhone; }

void ConnectionApproval::startAsking(uint32_t nowMs) {
  state_ = State::kAsking;
  sinceMs_ = nowMs;
}

ConnectionApproval::Action ConnectionApproval::onHello(uint32_t appId, const char* name, uint32_t nowMs,
                                                       ApprovedApps& approved) {
  if (state_ == State::kApproved) return Action::kSendAccepted;  // repeated hello: same answer
  if (state_ != State::kWaitingForHello && state_ != State::kAsking) return Action::kNone;
  appId_ = appId;
  hasAppId_ = true;
  setName(name_, name);
  if (approved.contains(appId)) {
    approved.remember(appId);  // most recent first
    state_ = State::kApproved;
    return Action::kSendAccepted;
  }
  startAsking(nowMs);
  return Action::kSendWaiting;
}

ConnectionApproval::Action ConnectionApproval::update(uint32_t nowMs) {
  if (state_ == State::kWaitingForHello && nowMs - sinceMs_ >= kHelloWaitMs) {
    startAsking(nowMs);  // no hello (e.g. nRF Connect): ask about "A PHONE"
    return Action::kSendWaiting;
  }
  if (state_ == State::kAsking && nowMs - sinceMs_ >= kAnswerTimeoutMs) {
    state_ = State::kNoPhone;
    return Action::kSendDeclinedAndDisconnect;
  }
  return Action::kNone;
}

ConnectionApproval::Action ConnectionApproval::answer(bool yes, ApprovedApps& approved) {
  if (state_ != State::kAsking) return Action::kNone;
  if (!yes) {
    state_ = State::kNoPhone;
    return Action::kSendDeclinedAndDisconnect;
  }
  if (hasAppId_) approved.remember(appId_);
  state_ = State::kApproved;
  return Action::kSendAccepted;
}

uint32_t ConnectionApproval::secondsLeftToAnswer(uint32_t nowMs) const {
  if (state_ != State::kAsking) return 0;
  const uint32_t elapsed = nowMs - sinceMs_;
  return elapsed >= kAnswerTimeoutMs ? 0 : (kAnswerTimeoutMs - elapsed + 999) / 1000;
}

}  // namespace jimmyit
