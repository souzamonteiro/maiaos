# Generated shell frontend performance — 2026-10-20

## Purpose and result

The owner clarified that the concern was the very large speed difference, not
only output equivalence. The finite differential corpus previously established
matching results. It did not establish matching computational cost.

The measured bottleneck on the C++98 -> C89 -> WASM path is lexing, particularly
the repeated zero-initialization of dense MaiaRegex memo tables. Measured parser
execution is a small fraction of this cost for the cases below. These results do
not attribute every delay in the full MaiaCC self-host bootstrap to shell lexing.

## Reproduction and method

Run `npm run benchmark:shell-parser`. It generates JS and C++98 from the unchanged
shell EBNF with the pinned repository MaiaCC. Native C++98 uses Clang `-O2` and
platform libc; WASM uses MaiaCpp AST-strict -> C89 -> MaiaC/MaiaWASM and the guest
MaiaC libc. No Emscripten generates the guest. Node v24.13.1 on darwin arm64 is the
native WebAssembly reference engine. No device or MaiaWASMVM result is claimed.

Thirteen inputs cover a simple command, four word lengths, four list lengths and
four subshell nesting depths. Four modes isolate lexing, parsing prelexed tokens,
parsing with the actual collector, and complete lexing/parsing with the collector.
JS parser state/memoization is reset between operations. Parser-only measurements
exclude lexing. Samples include parser state/collector setup as appropriate.

Each timing is the median of five warmed samples with an adaptive iteration
count. Generation, compilation, process startup, input transport and tree output
are outside the timed regions. C++/WASM iteration loops run inside the tested
implementation. Native uses process CPU time and JS/WASM use wall time; these
are indicative local measurements, not portable timing requirements. Runtime
checksum and stack restoration assertions pass. There are no timing pass/fail
thresholds. Temporary build artifacts and `report.json` are retained.

Allocation statistics come from a SEPARATE instrumented native build of the same
MaiaRegex source/patterns. All timed implementations are uninstrumented. Statistics
count cumulative memo `calloc` requests, not simultaneous live or retained memory.
A separate guest malloc/calloc probe checks the cost of zero-initialization.

## Measurements

Median lexer milliseconds per input (rounded):

| Input | JS | Native C++98 | Own-toolchain WASM |
|---|---:|---:|---:|
| `echo hello` (10 bytes) | 0.00363 | 0.00622 | 0.0499 |
| `echo ` plus 1024 `x` characters | 0.00604 | 0.170 | 4.63 |
| `echo x;` repeated 128 times (896 bytes) | 0.355 | 5.73 | 323.7 |

For the 896-byte input, WASM parsing alone is **0.143 ms**, or **0.320 ms** with
the collector, versus **323.7 ms** for lexing. This is not evidence of excessive
parser recursion causing that measured delay.

The full pipeline must be distinguished from its stages: JS's supplied
`ParseTreeCollector.checkpoint()` deep-clones its accumulated stack/tree. Full
lexing/parsing/tree collection of the 896-byte list costs about **1891 ms in JS**,
**5.52 ms in native C++98**, and **324.5 ms in WASM**. With `echo hello`, full JS
is **0.423 ms** and WASM **0.0527 ms**. Thus the same measurements do NOT support
an unconditional statement that the complete JS frontend is faster than WASM.
The selected collector materially affects that comparison.

Regex memo requests for flat lists:

| Commands | Input bytes | Memo allocations | Cumulative memo bytes |
|---:|---:|---:|---:|
| 4 | 28 | 560 | 170,864 |
| 16 | 112 | 2,240 | approximately 2,629,570 |
| 64 | 448 | 8,960 | approximately 41,656,100 |
| 128 | 896 | 17,920 | approximately 166,346,000 |

Increasing from 16 to 128 commands (8 times) increases cumulative memo bytes about
63 times. This is the measured near-quadratic growth on this input family.

Independent guest allocation/free medians from the same WASM module:

| Bytes | malloc + free | calloc + free |
|---:|---:|---:|
| 4096 | 0.0255 us | 7.97 us |
| 65536 | 0.0199 us | 126.9 us |
| 1048576 | 0.0173 us | 2144 us |

These are warm reused blocks, not freshly committed operating-system pages.
Measured calloc cost is around 1.9–2.0 ns per byte. Applying the 64 KiB rate to
the 166 MB cumulative memo requests predicts roughly 322 ms, close to the lexer
measurement of 324 ms. This is a cross-check/inference, not an exclusive profiler
measurement of every instruction in the lexer.

## Mechanism and next scoped work

- JS generated lexers use the JavaScript engine's native `RegExp` matching.
- The generated C++ lexer tries its token patterns with `maia_regex_exec`.
- MaiaRegex allocates a zeroed memo table for each attempt with
  `instruction_count * (remaining input length + 1)` integer cells, including
  patterns that fail immediately. It also validates the remaining input.
- Many tokens produce many repeated suffix-sized allocations and clears.
- The guest's `maiac/src/stdlib.c` calloc currently clears in a byte-by-byte loop.
  Native Clang/platform-libc and the MaiaC guest have different optimization paths.
- The JS tree collector has its own growing deep-copy cost; it should not obscure
  an isolated lexer comparison.

The next performance correction should reduce repeated dense memo allocation/
clearing while preserving ordered matching, cycle/assertion semantics, resource
limits and the differential corpus. Improving guest zero-fill code is another
scoped optimization, but it does not eliminate the asymptotic allocation volume.
A source change belongs in the principal MaiaRegex/MaiaC/MaiaCC repository as
appropriate, followed by the ecosystem protocol. No such change was made in this
measurement task. No grammar weakening, manual lexer, host matching, new OS API,
production memory-limit increase or generated-source patch is involved.

Final phased report and sources:
`/var/folders/6p/871hys095mq5mm7078sqplx40000gn/T/maia-shell-performance-nXNEe7`.
The first completed core run has `report.json`; its separately run guest allocator
probe is in `allocation-report.json`. The current script also records that probe
in `report.json` on future complete runs. Log: `/tmp/maia-shell-performance.log`.
