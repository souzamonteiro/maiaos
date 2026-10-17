# MaiaWASM runtime design

## Preserve the existing disassembler

The current MaiaWASM disassembler is written in ES8 JavaScript and translates WASM to WAT. It reportedly validates input, but semantic validation coverage must be audited. Reuse its binary section and instruction decoding **only after reviewing actual source**. The new interpreter must execute decoded binary instructions, not WAT strings.

## Runtime subsystems

1. Binary reader (LEB128, section bounds, canonical/accepted encodings as required).
2. Module decoder (types, imports, functions, code, memories, tables, globals, exports, data, elements).
3. Validator (stack typing, control flow, index validity, feature flags, memory/table limits).
4. Linker (imports with module/name/signature/version checks).
5. Instance (linear memories, tables, globals, call stack, value stack).
6. Interpreter (dispatch; trap and interruption semantics).
7. Host ABI (copy-in/copy-out and handles; never guest pointers as host pointers).
8. Diagnostics (instruction counts, trap codes, memory high-water marks).

## Interpreter strategy

- Stage A: arithmetic `i32`/`i64`, locals, calls, control flow, MVP memory and imports.
- Stage B: bulk memory, multi-value, reference types and relevant WASM 3.0 features.
- Stage C: advanced 3.0 features, only if needed by suite output and resource constraints.
- Decode to a compact instruction representation on load to avoid repeated LEB decoding.
- Use bounded value and call stacks; test recursive calls and out-of-bounds memory.
- Fuel accounting or time slicing at safe points; watchdog-friendly yields.

## Self-hosting route

ES8 source -> MaiaJS -> C89 -> native desktop and ESP-IDF RISC-V builds. Validate generated C89 using `-std=c89 -pedantic` where feasible, and compile with the actual ESP-IDF toolchain. Keep JS/C output tests identical. ES8 features with expensive runtime translation must be profiled and restricted in the VM hot path if needed.

## Reference engines

Use browser/Node native WebAssembly and optionally WAMR for differential tests. Never confuse a successful reference-engine test with successful MaiaWASM interpreter execution.

## Important limitations

WebAssembly 3.0 core feature compliance is a target, not a present implementation claim. Threads/atomics require separate profile negotiation and careful synchronization; host SMP alone does not imply WASM threads.
