// Jimmy's face for the OLED, after the app's Jimmy: a solid round head, ring
// eyes with the pupils looking right (or, squinting, two happy arches), and a
// sideways smile with the tongue out, drawn in black on a white head. Shared by
// the boot animation and the result screen.
#pragma once

#include <stdint.h>

#include "raster.h"

namespace jimmyit {

// rotationDeg turns the face about its center (positive = clockwise): a tilt, or rolling.
// A black ring around the head keeps him apart from anything white behind him.
void drawJimmyFace(Raster& raster, int16_t cx, int16_t cy, int16_t radius, float rotationDeg, bool squint);

}  // namespace jimmyit
