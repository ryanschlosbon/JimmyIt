#include "score_log.h"

#include <string.h>

namespace jimmyit {

namespace {
constexpr uint8_t kSerialFormatVersion = 1;
}  // namespace

RecordMessage toRecordMessage(const ScoreEntry& entry) {
  RecordMessage message;
  message.type = MessageType::kRecord;
  message.recordId = entry.recordId;
  message.modeId = entry.modeId;
  message.flags = entry.flags;
  message.startUnix = entry.startUnix;
  message.durationS = entry.durationS;
  message.score = entry.score;
  message.actions = entry.actions;
  return message;
}

ScoreLog::ScoreLog() { clear(); }

void ScoreLog::clear() {
  memset(entries_, 0, sizeof(entries_));
  memset(bests_, 0, sizeof(bests_));
  head_ = 0;
  count_ = 0;
  nextRecordId_ = 1;
  ackedRecordId_ = 0;
}

uint32_t ScoreLog::add(ScoreEntry entry) {
  entry.recordId = nextRecordId_++;
  if (count_ < kCapacity) {
    entries_[(head_ + count_) % kCapacity] = entry;
    count_++;
  } else {
    entries_[head_] = entry;  // overwrite the oldest
    head_ = (head_ + 1) % kCapacity;
  }
  return entry.recordId;
}

size_t ScoreLog::unsyncedCount() const {
  size_t n = 0;
  for (size_t i = 0; i < count_; i++) {
    if (entries_[(head_ + i) % kCapacity].recordId > ackedRecordId_) n++;
  }
  return n;
}

size_t ScoreLog::collectAfter(uint32_t afterRecordId, ScoreEntry* out, size_t maxOut) const {
  size_t written = 0;
  for (size_t i = 0; i < count_ && written < maxOut; i++) {
    const ScoreEntry& entry = entries_[(head_ + i) % kCapacity];
    if (entry.recordId > afterRecordId) out[written++] = entry;
  }
  return written;
}

void ScoreLog::ack(uint32_t upToRecordId) {
  if (upToRecordId > ackedRecordId_ && upToRecordId <= newestRecordId()) ackedRecordId_ = upToRecordId;
}

uint32_t ScoreLog::best(uint8_t modeId) const { return modeId <= kMaxModeId ? bests_[modeId] : 0; }

void ScoreLog::raiseBest(uint8_t modeId, uint32_t score) {
  if (modeId <= kMaxModeId && score > bests_[modeId]) bests_[modeId] = score;
}

// Layout: version u8, nextRecordId u32, ackedRecordId u32, head u16, count u16,
// kCapacity RecordMessage-shaped slots, bests u32 x (kMaxModeId + 1).
void ScoreLog::serialize(uint8_t* out) const {
  uint8_t* p = out;
  *p++ = kSerialFormatVersion;
  memcpy(p, &nextRecordId_, 4);
  p += 4;
  memcpy(p, &ackedRecordId_, 4);
  p += 4;
  const uint16_t head = static_cast<uint16_t>(head_);
  const uint16_t count = static_cast<uint16_t>(count_);
  memcpy(p, &head, 2);
  p += 2;
  memcpy(p, &count, 2);
  p += 2;
  for (size_t i = 0; i < kCapacity; i++) {
    const RecordMessage slot = toRecordMessage(entries_[i]);
    memcpy(p, &slot, sizeof(slot));
    p += sizeof(slot);
  }
  memcpy(p, bests_, sizeof(bests_));
}

bool ScoreLog::deserialize(const uint8_t* in, size_t length) {
  clear();
  if (length != kSerializedBytes || in[0] != kSerialFormatVersion) return false;
  const uint8_t* p = in + 1;
  uint32_t nextRecordId, ackedRecordId;
  uint16_t head, count;
  memcpy(&nextRecordId, p, 4);
  p += 4;
  memcpy(&ackedRecordId, p, 4);
  p += 4;
  memcpy(&head, p, 2);
  p += 2;
  memcpy(&count, p, 2);
  p += 2;
  if (nextRecordId == 0 || head >= kCapacity || count > kCapacity) return false;
  for (size_t i = 0; i < kCapacity; i++) {
    RecordMessage slot;
    memcpy(&slot, p, sizeof(slot));
    p += sizeof(slot);
    entries_[i] = ScoreEntry{slot.recordId, slot.modeId, slot.flags, slot.startUnix, slot.durationS, slot.score, slot.actions};
  }
  memcpy(bests_, p, sizeof(bests_));
  nextRecordId_ = nextRecordId;
  ackedRecordId_ = ackedRecordId;
  head_ = head;
  count_ = count;
  return true;
}

}  // namespace jimmyit
