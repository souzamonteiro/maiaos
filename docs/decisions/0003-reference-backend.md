# ADR 0003: Reference WASM engine is temporary

**Status:** Accepted for initial design.

**Decision:** Browser native WebAssembly runs the UI prototype, while the MaiaWASM interpreter is built separately. The reference engine is an oracle for tests, not a substitute for the project goal.

**Consequences:** Immediate UI development; requires strict labels and differential tests to avoid false confidence.
