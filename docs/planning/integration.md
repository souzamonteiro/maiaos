# Maia Suite integration

MaiaOS uses the Maia Suite through the `maiacpp` Git submodule. MaiaCpp contains nested submodules for MaiaC, MaiaCC and MaiaWASM; `git submodule update --init --recursive` materializes the complete compiler toolchain. The MaiaOS `./git_pull.sh` helper synchronizes the parent repository and recursively initializes/updates those submodules.

Normal builds must use these in-repository checkouts, not sibling directories or an npm-installed compiler. The parent gitlink pins the MaiaCpp commit, and MaiaCpp's gitlinks pin the nested compiler commits. Review and commit pointer changes in the relevant parent repository when intentionally advancing the toolchain.

The current kernel, Calculator and Clock guests are C++98 and use `maiacpp/bin/webcpp.sh --ast-strict`. MaiaCpp lowers C++98 to C89; MaiaC compiles that C to WASM, with MaiaWASM assembling/validating the module. MaiaCC generates parsers from their owning EBNF grammars. Emscripten is reserved for the separate LVGL-WASM browser platform module, not MaiaOS guest binaries.

## Suggested approach

- Preserve original projects and history through the pinned recursive Git submodules.
- Add a `maiawasm-core` adapter that consumes existing decoded module structures if stable.
- Make MaiaJS-generated C89 a reproducible artifact, never manually edit generated files.
- Pin compiler version, feature flags, input SHA-256 and generated output SHA-256.
- Add cross-compiler tests for C89, C++98 and ES8; compare guest results and traps.
- Keep runtime licensing compatible with Apache-2.0; audit dependencies.

## Questions to resolve from source

1. Does MaiaWASM validate full semantic typing or only binary structure?
2. Which WebAssembly 3.0 proposals are decoded and emitted?
3. How are 64-bit values and IEEE754 edge cases represented by MaiaJS C89 codegen?
4. What does "SMP support" mean in each Maia component?
5. Can the existing compiler emit a bounded memory32 profile with controlled imports?
6. Can the C89 output compile without a JS garbage-collected runtime?
