# Processes, scheduling, security

## Process model

A process is a WASM instance plus metadata, memory/table allocations, resource handles, capability set and event queue. PID is an opaque ID, not an OS PID. Multiple instances may share a module's immutable decoded code but never mutable state by default.

## Scheduling

- Phase 1: one interpreter worker, cooperative fuel-limited turns, deterministic event loop.
- Phase 2: multiple independent instances on FreeRTOS tasks, capped task counts and core affinity measured empirically.
- Phase 3: optional threads/atomics profile only after implementing correct WASM shared memory semantics.

A runaway loop must not freeze the display. The UI task remains separate. The interpreter must have a reliable preemption/interrupt strategy; host browser WebAssembly calls cannot be safely assumed fuel-preemptible.

## Isolation and permissions

- Validate binary and imports before execution.
- Bound linear memory, call/value stacks, tables, file handles, graphics objects and CPU fuel.
- Never expose raw pointers, file descriptors or LVGL objects.
- Per-app filesystem namespaces and manifest-requested capabilities with user/system policy enforcement.
- Treat SD files as untrusted; validate packages and optional signatures.
- Use a native recovery mode for corrupt SD and broken init.
- WebAssembly memory safety does not imply complete system security: side channels, malicious imports and denial of service remain concerns.

## Memory plan

Start with measurable per-instance budgets, not assumed guaranteed allocations. One 1280x720 RGB565 framebuffer is 1,843,200 bytes; prefer partial buffers and characterize PSRAM throughput. Test worst-case memory fragmentation, SD I/O and display concurrently.
