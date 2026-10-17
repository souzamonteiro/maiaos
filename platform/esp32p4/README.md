# ESP32-P4 / M5Stack Tab5 platform (planned)

Use Espressif ESP-IDF, FreeRTOS, the Tab5 board support package, LVGL, SD/MMC, PSRAM and watchdog. Pin compatible ESP-IDF/BSP/LVGL versions after hardware bring-up. No claim of tested hardware support in this scaffold.

## Intended components

- `maiaos_platform_init`: clocks, memory, logging, display, touch, storage.
- `maiaos_runtime`: MaiaWASMVM, authored in ES8 and ported to C89 with MaiaJS when the compiler/runtime path is verified.
- `maiaos_host`: VFS, GFX, events, time, capabilities and instance lifecycle callbacks.
- `maiaos_boot`: mount SD, load `/system/kernel.wasm`, execute its `maiaos_start` export, and fall back to native recovery.

The kernel guest is C++98 compiled to standalone WASM. It imports `maia.*` services and does not contain Tab5/browser checks. The browser wrapper currently executes the same guest with native WebAssembly; this is a test substitute, not the device runtime.

**First hardware gate:** compile and run a basic Tab5 LCD/touch/SD example before linking the interpreter. Keep the standard Espressif bootloader.
