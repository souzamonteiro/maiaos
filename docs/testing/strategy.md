# Test strategy

1. Parser corpus: valid and malformed binaries, section ordering, bounds and LEB128.
2. Semantic validation: type stack, branch targets, imports, limits, feature flags.
3. Interpreter: numeric ops, memory, control, recursion, traps, fuel and cancellation.
4. Differential: MaiaWASM JS vs MaiaJS-generated C89 vs reference runtime.
5. ABI: guest memory bounds, ownership, invalid handles, capabilities and version negotiation.
6. Graphics: commands, events, widget lifecycle, task serialization, screenshot comparisons where deterministic.
7. VFS: path traversal, mount isolation, SD removal, power loss and quotas.
8. Device: boot/recovery, memory high-water, UI latency, watchdog, SD throughput, touch responsiveness.
9. Security: fuzz binary loader, invalid UTF-8, resource exhaustion and malicious guest behavior.

A reference engine passing a test does not mean MaiaWASM passed it. Store engine identity and build commit with every result.
