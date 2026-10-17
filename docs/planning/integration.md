# Existing Maia suite integration

Existing MaiaJS, MaiaC, MaiaCpp, MaiaCC and MaiaWASM repositories are **not copied** into this scaffold because their source and exact URLs have not been supplied. Do not invent repository APIs.

## Suggested approach

- Preserve original projects and history; integrate with pinned Git submodules or a reproducible dependency script after review.
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
