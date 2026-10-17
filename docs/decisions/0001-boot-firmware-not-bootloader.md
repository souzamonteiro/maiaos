# ADR 0001: Native boot host loads the MaiaOS WASM guest

**Status:** Accepted for initial design.

**Context:** The initial MaiaOS kernel guest is C++98 compiled directly to WASM. The device needs a small trusted native platform host for MaiaWASMVM, drivers, LVGL, recovery, and platform callbacks.

**Decision:** Keep the Espressif ROM and second-stage bootloader standard. Native ESP-IDF firmware initializes MaiaWASMVM and its callback table, then loads `/system/kernel.wasm` from microSD. The same C++98 guest runs in the browser wrapper; only the host callback implementation and temporary VM engine change. A minimal native recovery mode survives SD failure.

**Consequences:** The OS guest remains platform-agnostic and WASM-first, while hardware access stays behind replaceable callbacks. Recovery and secure boot remain native responsibilities.
