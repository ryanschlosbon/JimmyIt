// Keeps the ScoreLog in the nRF52840's internal flash so toy-scored games
// survive power-off until the app syncs them.
#pragma once

#include "src/score_log.h"

bool storageBegin();
// Loads the saved log, or leaves `log` empty if there is none or it is unreadable.
bool storageLoad(jimmyit::ScoreLog& log);
bool storageSave(const jimmyit::ScoreLog& log);
