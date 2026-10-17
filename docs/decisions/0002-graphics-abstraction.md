# ADR 0002: Platform-independent MaiaGFX

**Status:** Accepted for initial design.

**Decision:** Apps call versioned MaiaGFX imports with handles; backends are Canvas (rapid browser prototype), LVGL desktop (parity) and LVGL ESP32-P4 (device). The API never exposes LVGL internals.

**Consequences:** Extra abstraction and translation cost, but applications can be developed before board bring-up. Canvas is not a pixel-perfect LVGL simulator.
