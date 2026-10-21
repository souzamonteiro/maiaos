# Application packaging v0

An application is a directory containing `app.wasm`, `manifest.json`, optional assets and an optional signature. Packages are stored under `/apps/<id>/`. The C++98 MaiaOS kernel guest is `/system/kernel.wasm` with `/system/kernel.json`; the native device boot host and browser wrapper read the same entry metadata and supply platform callbacks. The bounded reference `io.wasm` and `shell.wasm` guests have sources/manifests in `apps/io` and `apps/shell`; `desktop.wasm` remains planned.

Current C++98 guests are built from source through MaiaCpp AST-strict -> C89 -> MaiaC -> WASM, using the recursive in-repository Maia toolchain submodules. Emscripten is used for the separate LVGL-WASM browser platform module only.

The current kernel manifest selects `maiaos_start` as its entry export and `maiaos_step` as its scheduler-step export. The host invokes the entry once, then schedules the step export; guest events are consumed through `maia.events.poll` rather than direct host-to-guest function calls.

```json
{
  "schema": 1,
  "id": "org.maiaplatform.calculator",
  "name": "Calculator",
  "version": "0.1.0",
  "entry": "app.wasm",
  "entryExport": "maia_app_start",
  "stepExport": "maiaos_step",
  "abi": "maiaos-0",
  "wasmProfile": "maiaos-embedded-v0",
  "capabilities": [
    "gfx.window", "gfx.label", "gfx.label.set_text", "gfx.button",
    "events.poll", "process.exit"
  ],
  "limits": { "memoryPages": 32, "openFiles": 4 }
}
```

The manifest is a **request**, not an authorization. Each host maps imported WASM names to capability names, requires every import to be requested here, then applies its independent policy grants. Unknown imports and imports denied by policy must be rejected before guest execution. Installation must verify path confinement and package size; optional package signatures are a future deployment requirement. `limits` cannot raise host policy maxima.

The browser reference host supports `entryExport` plus an optional `stepExport`. It creates one host-import table, guest memory, event queue and VFS adapter per running app. LVGL is shared; button handles are routed to the owning process. `maia.process.exit(i32)` ends that app instance and destroys its root window without stopping the kernel or other apps. App scheduling runs on the browser animation frame and does not claim VM fuel or preemption. Launching the shell also starts its I/O service with independent memory and stream capabilities. Only I/O requests `tty.input`; the boot host supplies stdin/stdout/stderr bindings described in [ABI v0](abi-v0.md). Manifest memory limits are checked at startup; runtime memory/fuel enforcement remains pending.

The directory extension maps `maia.vfs.opendir/readdir` to requested capabilities
`vfs.opendir/readdir`; both remain subject to host policy. File and directory
handles share `limits.openFiles`, passed to the adapter and capped at 16 in the
reference host. A zero limit (I/O guest) forbids VFS handle allocation. All VFS
handles are released at exit/trap/failed startup.
