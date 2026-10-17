# WebAssembly 3.0 and embedded profile

The Maia suite targets **WebAssembly 3.0**. MaiaOS defines a restricted execution profile, `maiaos-embedded-v0`, to make that standard feasible on a memory-constrained microcontroller. A module must declare its required features and the runtime must validate them. Unsupported features produce a clear load error.

## Proposed v0 feature set

Required: core integer and floating point arithmetic, structured control flow, functions, globals, tables, memory32, data/element segments, imports/exports, indirect calls, and selected widely used post-MVP features once verified against Maia compiler output. Exact features are a **to-be-frozen checklist**, not an assertion of implementation.

Deferred pending measurements and need: GC, Memory64, multiple memories, exceptions, tail calls, SIMD, relaxed SIMD, and threads/atomics. Some may be required by existing compiler output; inspect fixtures before freezing.

## Limits

Runtime-configurable maximum pages per instance, call stack depth, operand stack depth, table entries, module bytes, number of imports, fuel per scheduling turn and instance count. Defaults will be set only after Tab5 profiling.

## Conformance

Use official WASM spec tests as permitted by their licensing, plus fixtures compiled by MaiaC/MaiaCpp/MaiaJS and invalid-module fuzz tests. Report `parse`, `validate`, `link`, `instantiate` and `runtime trap` failures separately. Never describe the small experimental interpreter as WASM 3.0 compliant.
