// Ring log of standalone games scored on the fidget, plus per-mode bests.
// Pure logic: the sketch saves serialize() output to flash (InternalFS) and
// restores it with deserialize() at boot.
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "fidget_protocol.h"

namespace jimmyit {

struct ScoreEntry {
  uint32_t recordId;
  uint8_t modeId;
  uint8_t flags;  // RecordFlag masks
  uint32_t startUnix;
  uint16_t durationS;
  uint32_t score;
  uint16_t actions;
};

RecordMessage toRecordMessage(const ScoreEntry& entry);

class ScoreLog {
 public:
  static constexpr size_t kCapacity = 64;
  static constexpr uint8_t kMaxModeId = 63;

  ScoreLog();

  // Empties the log and bests, in place (no large temporaries on the stack).
  void clear();

  // Stores a finished game, assigning the next record id. Returns that id.
  uint32_t add(ScoreEntry entry);

  size_t count() const { return count_; }
  uint32_t newestRecordId() const { return nextRecordId_ - 1; }
  uint32_t ackedRecordId() const { return ackedRecordId_; }
  size_t unsyncedCount() const;

  // Copies stored entries with recordId > afterRecordId, oldest first.
  // Returns how many were written to `out` (at most maxOut).
  size_t collectAfter(uint32_t afterRecordId, ScoreEntry* out, size_t maxOut) const;

  void ack(uint32_t upToRecordId);

  uint32_t best(uint8_t modeId) const;
  // Keeps the higher of the stored best and `score` (the app may know a higher one).
  void raiseBest(uint8_t modeId, uint32_t score);

  // Persistence. The format starts with a version byte; deserialize() rejects
  // anything it does not recognise and leaves the log empty.
  static constexpr size_t kSerializedBytes = 1 + 4 + 4 + 2 + 2 + kCapacity * sizeof(RecordMessage) + 4 * (kMaxModeId + 1);
  void serialize(uint8_t* out) const;
  bool deserialize(const uint8_t* in, size_t length);

 private:
  ScoreEntry entries_[kCapacity];
  size_t head_;   // index of the oldest entry
  size_t count_;
  uint32_t nextRecordId_;
  uint32_t ackedRecordId_;
  uint32_t bests_[kMaxModeId + 1];
};

}  // namespace jimmyit
