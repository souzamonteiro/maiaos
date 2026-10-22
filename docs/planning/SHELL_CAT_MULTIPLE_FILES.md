# Sequential multi-file cat

2026-10-21. The owner approved this as the first next shell slice, followed by
legacy emitted-C diagnostics, output redirection contracts, then pipelines.
Baseline MaiaOS main 9efca1d (suite version 1.6.1). Existing dirty nested
MaiaGlob compiler pointer is preserved; no publication/version/npm is implied.

## Contract

`cat <file> [file ...]` consumes the final argv after generated shell parsing,
quote removal and MaiaGlob expansion. Process operands in argv order, including
repeated files and per-pattern byte sorting already provided by expansion.
Open exactly one READ file at a time through existing VFS imports. Preserve all
bytes without adding headings, separators or newlines. Keep the bounded 128-byte
read buffer and stream backpressure state machine. Display one prompt after the
whole operation, or drain and exit without a prompt for final stdin EOF.

Opening/path/permission/quota/read errors retain existing diagnostics on stderr,
close the current handle and continue with the next operand. VFS remains the
sole authorization authority; cwd is unchanged. No directory metadata probing.
Empty operands fail as invalid paths but do not cancel later operands. Zero
operands and any leading-dash operand reject the entire argv with usage before
file I/O; stdin/options/`--` support are outside this slice. `./-name` works.

Preserve 255 input bytes, 32 tokens, 12 argv slots, 95 bytes per expanded operand
and 1023 normalized path bytes. Expansion limits fail before any operand is
opened. Never silently truncate or execute partial expansion. Closed output or
host teardown cancels further operands and closes resources. The existing fatal
process-exit policy is unchanged; per-command exit statuses are not added here.

## Acceptance

Actual guest WASM tests compare exact binary concatenation across boundaries,
glob ordering, duplicates, empty/quoted UTF-8 operands, errors between valid
files, read failure after partial output, single prompt, final EOF, slow/closed
peers, rejected options before opening anything, at most one live file handle,
repeated operations, stable stack/memory and private-home isolation. Retain
existing single-file cases and real kernel/I/O/LVGL integration tests. Build via
own published MaiaCpp -> C89 -> MaiaC/MaiaWASM, with strict C89 checking.
No grammar/generated-parser, host ABI, capability, memory quota or VFS API change.

## Verified result

Strict C89 build PASS: 1258800-byte WASM; no new imports/capabilities.
`npm test` PASS (38); test:shell-files, test:shell-glob,
test:shell-directories, test:io-streams, test:shell-boot, test:shell-lvgl and
test:lvgl-host PASS. File tests retain the 128KiB binary/1000-read regressions
and add literal/glob order, duplicate operands, exact 128KiB+binary concatenation,
200 repeated concatenations, continued open/permission/path/read errors, option
rejection before file I/O, one live handle, final EOF and no later file opening
after peer closure. Actual LVGL multi-file/glob commands pass with 2049 flushes,
74557 kernel steps and stable shell18/I/O2 pages. No commit/push for this slice.
