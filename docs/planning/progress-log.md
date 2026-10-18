# Engineering log

## 2026-10-18
- [x] MaiaOS has a recursive MaiaCpp submodule containing the pinned MaiaC, MaiaCC and MaiaWASM toolchain.
- [x] `build:kernel` and `build:apps` compile the C++98 kernel, Calculator and Clock through MaiaCpp AST-strict -> C89 -> MaiaC -> WASM.
- [x] Browser reference host runs the kernel, Calculator and Clock guests through the `maia.*` ABI.
- [ ] Native Tab5 boot host/MaiaWASMVM integration remains planned.
- [ ] `io.wasm`, `shell.wasm` and `desktop.wasm` remain planned; only shell grammar/parser fixtures exist.

## Baseline
- [x] Architecture and repo scaffold
- [x] Browser desktop mock and reference-engine WASM demo
- [x] Experimental subset interpreter and tests
- [ ] MaiaWASM decoder integration
- [ ] MaiaJS C89 generation proof
- [ ] Native desktop LVGL
- [ ] Tab5 BSP and firmware

Record dates, commit IDs, performance metrics, regressions and blockers here.
