# MaiaOS Web Simulator — Prototype 0.1

A self-contained browser prototype of the MaiaOS graphical environment, drawn on an HTML Canvas and styled after embedded LVGL widgets. No external dependencies or build steps.

## Run

```bash
python3 -m http.server 8080
```

Open http://localhost:8080 and click inside the screen to type.

## Included
- 1280 × 720 logical display, Tab5-inspired frame and optional virtual keyboard
- Launcher, draggable windows, Terminal, Files, Settings, Monitor, Calculator, Editor preview
- Sample shell commands: `help`, `ls`, `pwd`, `cd`, `echo`, `date`, `ps`, `clear`, `cat`, `maia run /apps/hello.wasm`
- `maia run /apps/hello.wasm` executes a minimal embedded WebAssembly module in the **browser's native WASM engine** and returns 42. It does not load an actual `.wasm` from storage yet.
- Screenshot export and simulated SD mount toggle

## Limitations

This is a **visual and interaction prototype**, not LVGL/WASM, a complete operating system, or MaiaWASMVM. The UI is drawn in Canvas 2D; the virtual filesystem is currently mock data and does not persist. The editor is a read-only preview. CPU/memory/storage readings are illustrative, not actual measurements. The virtual keyboard is schematic and does not yet reproduce the real Tab5 keyboard matrix. The graphical shell and window controls are prototype behavior, not a stable MaiaOS ABI.

## Architecture next steps

This is the original Canvas-mock plan and is superseded by the active LVGL-WASM host in `platform/desktop-web`. Emscripten now builds that separate LVGL platform module; MaiaOS C++98 guests use MaiaCpp -> MaiaC. The steps below are historical context, not the current build instructions.

1. Extract `MaiaGFX` drawing primitives from the Canvas code.
2. Separate input, VFS, IPC, and process management behind stable interfaces.
3. Integrate MaiaWASMVM and real WASM loading from a virtual SD image.
4. Add IndexedDB persistence and an editable text widget.
5. Implement an LVGL backend using a reproducible Emscripten build, then an ESP-IDF backend.
