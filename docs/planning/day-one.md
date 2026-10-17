# Tomorrow: first development session

1. Create GitHub repository `maiaos` (Apache-2.0) and push this scaffold.
2. Run `npm test` and `npm run demo`; inspect the browser proof of concept.
3. Clone existing MaiaWASM and MaiaJS repositories; record commit hashes and supported language constructs.
4. Inspect disassembler AST/decoder and semantic validation; do **not** rewrite before auditing.
5. Build a compatibility matrix for ES8 -> C89: typed arrays, closures, exceptions, object allocation, bitwise operations, 64-bit integer handling.
6. Create three tiny WASM fixtures from MaiaC: `add`, `factorial`, and `hello` (host import). Store compiler flags and generated binaries.
7. Build `apps/kernel/kernel.cpp` as C++98 freestanding `kernel.wasm` with imports limited to the MaiaOS callback ABI.
8. Extend the interpreter experiment to run `add` with `local.get` and `i32.add`; add negative tests.
9. Build LVGL-WASM for the browser; verify flush-image callbacks and normalized input callbacks without an SDL window.
10. Initialize ESP-IDF and verify the Tab5 BSP example separately from MaiaWASMVM.
11. Record measurements, blockers and decisions in `docs/planning/progress-log.md`.

**Stop/go gate:** the generated C89 binary parser must pass the same corpus as JS before investing in the full VM.

## Commands

```sh
npm test
npm run demo
# then visit http://localhost:8080
```

## Early risks

- MaiaJS C89 codegen may not support every JS feature used by disassembler.
- WASM 3.0 features and memory limits may exceed feasible embedded budgets.
- Browser WebAssembly does not emulate MaiaVM semantics, scheduling or traps precisely.
- LVGL's desktop port may differ from ESP32-P4 BSP version; pin versions.
- PSRAM latency, display buffers and SD throughput must be profiled together.
