# MaiaOS Browser Host

This directory previously contained a Canvas-drawn mock desktop. It is no longer the active simulator. The supported browser host is [`platform/desktop-web`](../platform/desktop-web/), where LVGL itself creates widgets and rasterizes the display. The HTML canvas there only receives image rectangles produced by LVGL's flush callback; it does not draw or simulate widgets.

## Build and run

From the repository root, initialize the recursive MaiaCpp toolchain submodules and build the guests with MaiaCpp/MaiaC. Emscripten (`EMSDK` defaults to `~/emsdk`) is required only for the separate LVGL-WASM browser platform module:

```sh
npm run build:lvgl
npm run demo
```

Open <http://localhost:8080>. The page starts the LVGL-WASM host and kernel, then fills Applications from `apps/catalog.json`. Maia Calculator and Maia Clock launch as separate WASM instances, each with its own memory, event queue and app-private VFS namespace. The kernel continues running behind an app window; its close button destroys only that process's window.

The guest build path is C++98 -> MaiaCpp AST-strict -> C89 -> MaiaC -> WASM. `kernel.wasm`, Calculator and Clock are implemented; `io.wasm`, `shell.wasm` and `desktop.wasm` remain planned. The LVGL-WASM module is a platform renderer, not `desktop.wasm`.

The LVGL build is pinned to 9.3.0. To use an existing source checkout instead of FetchContent:

```sh
MAIAOS_LVGL_SOURCE_DIR=/path/to/lvgl npm run build:lvgl
```

## Runtime boundaries

- The guest imports platform-neutral `maia.*` callbacks; it contains no browser/device detection.
- In the browser, the temporary reference wrapper uses the browser's native WebAssembly engine. This is not MaiaWASMVM and supplies no VM fuel/preemption guarantee.
- Node uses the same native WebAssembly wrapper and callback interface. `npm run test:lvgl-host` exercises LVGL raster callbacks and event dispatch without an SDL window.
- On Tab5, firmware must implement the same host contracts by forwarding graphics/input to its LVGL task and services to platform callbacks. That firmware adapter is not implemented yet.
- Guest strings are validated and copied from guest memory; no guest pointer is passed to LVGL or JavaScript as a host pointer.

## Current vertical slice

The C++98 `apps/kernel/kernel.cpp` guest is compiled to `kernel.wasm`. It exports `maiaos_start` and `maiaos_step`, imports `maia.gfx.*`, `maia.events.poll`, `maia.vfs.*`, and `maia.log.write`, and creates real LVGL widgets. At startup, the kernel opens and reads `/system/welcome.txt` through the VFS. Its LVGL window can reload that file and write/read `/home/org.maiaos.kernel/maia-note.txt`. The browser hydrates each app's private `/home/<app-id>` and shared `/shared` mounts from IndexedDB; `/tmp` remains volatile. Node uses the bounded in-memory adapter.

`apps/examples/calculator/calculator.cpp` builds to a standalone `app.wasm` with `maia_app_start` and `maiaos_step` exports. It demonstrates LVGL labels/buttons, event polling, and `maia.process.exit`. `apps/examples/clock/clock.cpp` uses the same lifecycle plus `maia.time.monotonic_ms` to update uptime on scheduled steps. The browser app launcher validates manifest requests against host grants, creates a separate host-import instance and VFS namespace, routes button handles to the owning process, and schedules each running process. Closing either app destroys only its window while the kernel keeps running. The native browser/Node WebAssembly engine remains a reference backend, not MaiaWASMVM.

LVGL's `flush_cb` sends RGB565 pixel areas to JavaScript; the host does not draw widgets or call a guest event callback directly. Physical Tab5 firmware and ESP-IDF are explicitly outside the current implementation scope.

This validates the browser process and callback slice, not MaiaWASMVM validation/fuel, full OS service coverage, or physical Tab5 behavior. The native browser/Node engine remains an explicitly temporary substitute until MaiaWASMVM is ready.

## Feasible next steps

1. Add more runnable WASM apps and improve the browser app catalog/launcher.
2. Fill browser-side VFS, process, window, keyboard, and app lifecycle services with focused tests.
3. Replace the temporary native engine with MaiaWASMVM when its public instantiate API and host-import adapter are ready; keep LVGL callbacks unchanged.
4. Defer Tab5/ESP-IDF host bring-up until the browser simulator and app workflows are useful and stable.

The wrapper's job is to make host callbacks replaceable, not to emulate an operating system. LVGL is the widget renderer; each platform owns only the boundary that presents LVGL output and supplies hardware/services.
