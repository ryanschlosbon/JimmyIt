#include "score_storage.h"

#include <Adafruit_LittleFS.h>
#include <Arduino.h>
#include <InternalFileSystem.h>

using namespace Adafruit_LittleFS_Namespace;
using jimmyit::ApprovedApps;
using jimmyit::ScoreLog;

namespace {
constexpr const char* kPath = "/scores.bin";
constexpr const char* kTempPath = "/scores.tmp";
constexpr const char* kApprovedPath = "/phones.bin";
constexpr const char* kApprovedTempPath = "/phones.tmp";
// Static: too large for the loop task's stack.
uint8_t buffer[ScoreLog::kSerializedBytes];
bool storageReady = false;

// LittleFS rename replaces the previous file after the new one is complete.
// A reset while writing leaves the old file available on the next boot.
bool saveFile(const char* path, const char* tempPath, const uint8_t* data, size_t length) {
  InternalFS.remove(tempPath);  // FILE_O_WRITE appends if a previous attempt left a temp file.
  File file(InternalFS);
  if (!file.open(tempPath, FILE_O_WRITE)) return false;
  const size_t written = file.write(data, length);
  file.close();
  if (written != length) {
    InternalFS.remove(tempPath);
    return false;
  }
  File saved(InternalFS);
  if (!saved.open(tempPath, FILE_O_READ)) return false;
  const bool complete = saved.size() == length;
  saved.close();
  if (!complete) return false;
  return InternalFS.rename(tempPath, path);
}
}  // namespace

bool storageBegin() {
  storageReady = InternalFS.begin();
  return storageReady;
}

bool storageLoad(ScoreLog& log) {
  log.clear();
  if (!storageReady) return false;
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
  if (!storageReady) return false;
  log.serialize(buffer);
  return saveFile(kPath, kTempPath, buffer, sizeof(buffer));
}

bool storageLoadApprovedApps(ApprovedApps& apps) {
  apps.clear();
  if (!storageReady) return false;
  File file(InternalFS);
  if (!file.open(kApprovedPath, FILE_O_READ)) return false;
  uint8_t bytes[ApprovedApps::kSerializedBytes];
  const int read = file.read(bytes, sizeof(bytes));
  file.close();
  return read == static_cast<int>(sizeof(bytes)) && apps.deserialize(bytes, sizeof(bytes));
}

bool storageSaveApprovedApps(const ApprovedApps& apps) {
  if (!storageReady) return false;
  uint8_t bytes[ApprovedApps::kSerializedBytes];
  apps.serialize(bytes);
  return saveFile(kApprovedPath, kApprovedTempPath, bytes, sizeof(bytes));
}
