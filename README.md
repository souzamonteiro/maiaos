> **Updated architecture (2026-10-17):** [MaiaOS Architecture, Product Vision and Implementation Plan](docs/MAIAOS_ARCHITECTURE_VISION_2026.md). Includes simulator, keyboard, MaiaWASMVM, IPC, shell, windows and Mermaid diagrams.

# MaiaOS

**A WebAssembly-first, portable embedded application operating environment.**

MaiaOS is designed to run on desktop hosts during development and on the M5Stack Tab5 (ESP32-P4) in production. The initial OS kernel is written in freestanding C++98 and compiled to `kernel.wasm`; it calls only platform-neutral `maia.*` imports. The native device boot host supplies MaiaWASMVM, recovery, drivers, and native callbacks. In the browser, a wrapper temporarily uses the browser's native WebAssembly engine and JavaScript callbacks. The MaiaWASM VM remains a separate runtime project and will replace that browser reference engine when ready. The guest does not detect whether it is running in the browser or on the device.

> **Project status: browser simulator runs the C++98 WASM kernel plus Calculator and Clock apps through LVGL-WASM.** App instances have separate memories, event queues, and `/home/<app-id>` VFS namespaces; the kernel remains running underneath app windows. Browser execution uses the native WebAssembly reference engine until MaiaWASMVM is ready. Physical Tab5/ESP-IDF work is intentionally deferred; `/tmp` remains volatile and browser `/home` plus `/shared` use IndexedDB.

## Design principles

1. Build and test on Linux/macOS/Windows first; move the same core and ABI to ESP-IDF.
2. Preserve the Espressif ROM/second-stage bootloader. Native platform firmware starts MaiaWASMVM and loads `/system/kernel.wasm` from microSD.
3. Keep the C++98 kernel guest independent of graphics, FreeRTOS, microSD, and ESP-IDF; keep the MaiaWASM VM/runtime as a separate layer.
4. Keep graphics, VFS, process, event, device and IPC APIs independent of their implementations.
5. Treat WASM modules as untrusted; validate, bound memory and CPU use, and mediate host calls.
6. Preserve ES8, C89, C++98 and WebAssembly 3.0 as suite targets, with an explicitly negotiated embedded feature profile.
7. Develop the interpreter in JS and verify generated C89 against identical conformance tests.

## Quick start (desktop)

Requires Node.js 18+ for the prototype (not a target-runtime requirement).

```sh
npm test
npm run build:lvgl
npm run demo
```

Open http://localhost:8080 . The browser wrapper loads the LVGL-WASM host and C++98 kernel. The Applications selector reads `apps/catalog.json`; launch Maia Calculator or Maia Clock as separate WASM instances, and close either app to return to the still-running kernel window.

To build the C++98 kernel guest and real LVGL browser module, provide Emscripten (`EMSDK` defaults to `~/emsdk`) and run:

```sh
npm run build:lvgl
npm run test:lvgl-host
```

`npm run build:kernel` builds only `apps/kernel/kernel.cpp` to a standalone `kernel.wasm`. `npm run build:apps` builds the Calculator and Clock guests. `npm run build:lvgl` builds the kernel, both apps, and LVGL-WASM host, fetches pinned LVGL 9.3.0 sources if `MAIAOS_LVGL_SOURCE_DIR` is not set, and runs the kernel/app process integration test under Node's native WebAssembly engine.

## Browser simulator milestone

The browser host now boots the kernel, launches manifest-based WASM apps, routes LVGL events to the owning process, schedules app step exports, enforces app memory/capability requests, and tears down an app on `maia.process.exit`. This uses the native browser WebAssembly engine as a reference runtime; MaiaWASMVM validation/fuel and physical Tab5 behavior are not claimed. ESP-IDF and the device host remain deferred while the simulator and app set are developed.

## Documentation

- [Architecture](docs/architecture/overview.md)
- [Boot process](docs/architecture/boot.md)
- [VM architecture](docs/architecture/runtime.md)
- [Graphics and VFS](docs/architecture/graphics-vfs.md)
- [Scheduler and security](docs/architecture/process-security.md)
- [ABI v0](docs/specifications/abi-v0.md)
- [Embedded WASM profile](docs/specifications/wasm-profile.md)
- [Application manifest](docs/specifications/app-manifest.md)
- [System applications](docs/product/system-apps.md)
- [Roadmap](docs/planning/roadmap.md)
- [ADRs](docs/decisions/)
- [Tomorrow's plan](docs/planning/day-one.md)
- [Repository integration](docs/planning/integration.md)

## Structure

```text
apps/               System applications and application fixtures
components/         Portable MaiaOS subsystems (contracts and starter code)
platform/           Browser desktop, desktop native and ESP32-P4 adapters
runtime/            MaiaWASM interpreter experiment and future core
docs/               Architecture, specs, decisions, plan and test strategy
tests/              Executable tests
scripts/            Build and validation scripts
```

License: Apache-2.0 (add upstream license headers and verify compatibility when integrating existing Maia projects).
