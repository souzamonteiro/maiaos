# Roadmap and acceptance gates

No calendar dates are promised; phases are gated by evidence.

## Toolchain and artifact baseline

- C++98 guest build: MaiaCpp AST-strict -> C89 -> MaiaC -> WebAssembly, using the recursive `maiacpp` submodule and its MaiaC, MaiaCC and MaiaWASM submodules.
- Emscripten is used for the LVGL-WASM browser platform module only; it does not compile MaiaOS guests.
- Implemented guests: `kernel.wasm`, Calculator and Clock.
- Planned guests: `io.wasm`, `shell.wasm` and `desktop.wasm`; none has a guest source/build target yet.
- The Espressif ROM/second-stage bootloader remains unchanged. Native MaiaOS platform firmware/boot host is a future device milestone; `platform/desktop-web/main.js` is the current browser boot coordinator.

## P0 — Browser callback contract prototype

- C++98 MaiaOS kernel guest compiled to freestanding `kernel.wasm`.
- Browser native WebAssembly guest execution as a temporary reference backend.
- LVGL compiled to WebAssembly owns widgets and rasterization; JavaScript only transports platform callbacks and presents LVGL flush images.
- Minimal experimental JS interpreter for a tiny subset, with explicit limitations.
- Unit tests and app manifest schema.
  **Exit:** `npm test`, Node LVGL/guest callback test, and browser image/input callback smoke checks pass.

## P1 — Integrate MaiaWASMVM and MaiaJS

- Audit existing disassembler validator coverage, decoder data structures and license.
- Import via adapter/submodule, preserving upstream history.
- Produce C89 output from ES8 parser; compare behavior on valid and invalid modules.
  **Exit:** same corpus passes JS and native C89 builds; no platform dependencies in runtime.

## P2 — Interpreter MVP on desktop

- Complete baseline validation, instance memory, tables, control flow, imports and traps.
- Resource limits and deterministic fuel-based interruption.
- Differential tests against a reference engine.
  **Exit:** representative MaiaC and MaiaCpp fixtures execute correctly in the Maia interpreter, not only in the reference engine.

## P3 — Device callback host + ABI

- Native ESP-IDF callback implementation for LVGL, display/input, VFS, time, and logging.
- VFS, event queues, process manager and basic GUI application lifecycle.
- Launcher, terminal, calculator.
  **Exit:** the same guest runs unchanged with browser LVGL-WASM callbacks and the device LVGL/driver callbacks.

## P4 — Tab5 hardware and VM port

- ESP-IDF project, Tab5 BSP, SD, LCD, touch, PSRAM, diagnostics.
- Build MaiaJS-generated C89 runtime for ESP32-P4.
- Boot `/system/kernel.wasm`, draw a widget through device LVGL callbacks, recover from SD failures.
  **Exit:** on-device boot demo and memory/latency report.

## P5 — Multitasking and hardening

- Multiple isolated instances, app switching, bounded CPU/memory, watchdog integration.
- Per-app capabilities, package manager, VFS confinement, crash recovery.
  **Exit:** invalid/malicious modules cannot hang UI or corrupt other app namespaces in defined tests.

## P6 — WebAssembly 3.0 coverage and self-hosting

- Add features required by compiler outputs and selected WASM 3.0 features.
- Benchmark JS, generated C89, device, and reference runtime.
- Explore executing portions of Maia toolchain as WASM apps.
  **Exit:** published conformance matrix, performance results and supported-feature declaration.

## Definition of done for each subsystem

Documented interface, host mock, native adapter, unit/integration tests, error handling, memory budget, failure/recovery path, and reproducible build instructions.
