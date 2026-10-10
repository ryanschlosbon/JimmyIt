#include "score_storage.h"

#include <Adafruit_LittleFS.h>
#include <Arduino.h>
#include <InternalFileSystem.h>

using namespace Adafruit_LittleFS_Namespace;
using jimmyit::ScoreLog;

namespace {
constexpr const char* kPath = "/scores.bin";
// Static: too large for the loop task's stack.
uint8_t buffer[ScoreLog::kSerializedBytes];
}  // namespace

bool storageBegin() { return InternalFS.begin(); }

bool storageLoad(ScoreLog& log) {
  log.clear();
  File file(InternalFS);
  if (!file.open(kPath, FILE_O_READ)) return false;
  const int read = file.read(buffer, sizeof(buffer));
  file.close();
  if (read != static_cast<int>(sizeof(buffer)) || !log.deserialize(buffer, sizeof(buffer))) {
    Serial.println("Saved scores unreadable; starting a new log");
    return false;
  }
  return true;
}

bool storageSave(const ScoreLog& log) {
  log.serialize(buffer);
  InternalFS.remove(kPath);  // FILE_O_WRITE appends, so start from an empty file
  File file(InternalFS);
  if (!file.open(kPath, FILE_O_WRITE)) return false;
  const size_t written = file.write(buffer, sizeof(buffer));
  file.close();
  return written == sizeof(buffer);
}
