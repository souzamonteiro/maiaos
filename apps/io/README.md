# Maia I/O reference guest

`io.cpp` is real freestanding C++98, lowered by pinned MaiaCpp AST-strict to C89,
then compiled/validated by MaiaC/MaiaWASM. `io.wasm` contains terminal rendering,
canonical ASCII input editing, one-line history and caret state. It imports
`maia.gfx`, `maia.events`, `maia.stream`, `maia.process`; it contains no shell
lexer/parser, command executor or VFS access. JavaScript supplies transport,
capability checks and scheduling; LVGL-WASM rasterizes the actual guest labels.

```sh
npm run build:io -- --check-c89
npm run test:io-streams
npm run test:shell-lvgl
npm run test:shell-boot
```

The build uses repository-local pinned dependencies. Clang optionally checks
emitted C89 syntax for wasm32; it never generates the guest. Emscripten builds
only the separate platform LVGL module. Launching Maia Shell in the app catalog
starts this I/O service before the shell, while the kernel keeps stepping.

The approved [stream ABI](../../docs/specifications/abi-v0.md) supplies write
handle3 (canonical stdin) and read aliases4/5 (ordered terminal output).
The shell owns prompt bytes and stdout/stderr. I/O renders the unfinished output
line plus edited input/caret in one label; completed lines use a history label.
The decoder preserves UTF-8 across stream reads and replaces malformed/truncated
sequences. Only clear/home terminal escape sequences are supported.

Limits: 255 printable ASCII editable bytes, 256 pending canonical bytes, 4096
terminal-history bytes, 4095 live-display bytes plus NUL. History resets at its
limit. Full input streams pause keyboard consumption; output is drained before
resuming pending input, with bounded work per scheduler step. Output EOF drains
and renders remaining text, then exits before accepting further queued keys.
Startup memory is2 pages, within the manifest budget of8 pages; runtime VM fuel
and memory enforcement, general terminal emulation, Unicode input editing and
native-device bindings remain pending. Native-engine/LVGL tests are reference
verification; interactive browser/touch/fullscreen checks remain separate.
