# MaiaGlob shell consumer integration

2026-10-21. Implements the already approved maiaglob/DESIGN.md contract after
owner publication c262104. Public GitHub creation, owner commit/push and consumer
submodule addition are authorized; MaiaOS/cat commit/push, npm and versions are
excluded. Preserve the pending cat changes.

Use only ./maiaglob and ./maiacpp in MaiaOS. Compile both generated C++98 frontends
through the local MaiaCpp, then link the portable Glob/Regex guest runtimes with
MaiaC. Do not hand-edit generated parsers or send patterns to host JavaScript.

Preserve generated shell word-token quote/escape provenance per decoded byte.
Use the library compiler for wildcard recognition and its resumable callback
walker for expansion between word evaluation and command dispatch. VFS adapters
call only existing opendir/readdir/close imports and existing cwd normalization;
validate directory packets before passing complete names to the library.
Collect and byte-sort matches per source word; commit argv only after every word
succeeds. Retain unmatched words, report malformed patterns and exhausted quotas,
and never execute partial argv. Keep 255 input bytes, 32 tokens, 12 total argv
slots, 95 bytes per word and 1023-byte normalized paths. Scheduling must yield
while traversing and under output backpressure. Close walker/list handles at EOF,
error, exit and peer closure. Preserve private-home isolation through VFS.

ls accepts zero or multiple file/directory operands. Zero operands lists cwd.
Reject options with usage; paths prefixed ./ can name files beginning '-'.
For multiple operands print escaped operand headings before directory listings;
print escaped file operands directly. Determine a file operand from a snapshot of
its authorized parent directory, without adding stat or probing VFS file data.
Continue later operands after a missing/denied/invalid operand. Directory-only
operands ending in slash must remain directories. The single-directory listing
format stays unchanged, including escaped control bytes and directory suffixes.

Tests: real guest WASM for mixed quoting, escaped backslashes and metacharacters,
Unicode/astral names, component/dot semantics, byte ordering, no match, invalid
patterns, argv/word limits without partial execution, files/directories/missing
operands, denied homes, cooperative traversal and stdout backpressure, repeated
memory/stack and handle cleanup. Retain grammar/frontend parity, unit, cat,
1024-entry directory and real kernel/I/O/LVGL regressions.

## Consumer validation result (2026-10-21)

The guest now builds with published MaiaC e173259, MaiaCpp f800a2f and MaiaGlob
c9bcef0 via MaiaOS's own submodules. `npm run build:shell -- --check-c89` PASS:
strict emitted C89 and actual WASM validation, 1258247-byte shell.wasm, SHA256
616381ca8730b8a42afa7ef28888c4b7697324403b20972139d7cce7e1004732.

`npm run test:shell-glob` PASS: quoted/escaped/single-quoted and mixed masks,
Unicode, classes, dots, component paths and absolute-to-relative reuse, byte
ordering per word, unmatched/invalid patterns, argv/word/open-handle limits with
no partial dispatch, multiple ls files/directories and continued errors, private
homes, escaped control names, 200 repetitions, EOF and peer-closure cleanup.
The 512-entry cooperative absolute walk verifies its three retained directory
snapshots by path (/, /shared, /shared/many), then requires all handles and stream
endpoints to close. The initial fixture incorrectly expected one handle; the
explicit-stack traversal contract retains its parents, so the stronger assertion
now checks actual authorized paths as well as the matching handle count.

Functional regression commands all PASS: npm test (38), test:io-streams,
test:shell-host, test:shell-files (128KiB binary / 1000 reads),
test:shell-directories (1024 entries / 1000 ls-cd cycles), test:shell-boot
(25 actual LVGL sessions), test:shell-lvgl and test:lvgl-host. The actual
LVGL/kernel/I/O/shell run recorded 2070 flushes and 74011 kernel steps, with
shell memory stable at 18 pages and I/O at 2. Interactive browser QA is not claimed.

MaiaC fixes belong to the owner compiler: complete indexed struct copies, correct
member-array/pointer-field strides, and sizeof(*struct_pointer) using the complete
aggregate layout without operand evaluation. The library runtime and both EBNFs
are unchanged. Owner harness coverage was strengthened after finding unexpanded
macro test calls; its 18 guest scenarios now actually execute and validate reused
walker state. See the published MaiaGlob implementation status and findings.

Recursive Git audit PASS: MaiaOS 34, MaiaGlob 16, MaiaCpp 15, MaiaJS 31 and MaiaC
7 initialized pins; every recorded checkout matches the intended published main
commit across seven GitHub repositories. MaiaOS feature files and gitlinks are
local only; main/origin stays 10f1a34. No npm, release-version or MaiaOS/cat
publication was performed. At that milestone, MaiaC/MaiaJS test-produced
examples were excluded from the compiler-fix publications; the subsequent owner
request to publish those artifacts is recorded below.

`npm run test:shell-grammar` and `npm run test:shell-parser` PASS, including
52 raw frontend cases and finite recursion-profile regressions. The existing
selected-scope grammar gaps remain declared. `npm run test:shell-equivalence`
PASS: 5356 raw inputs, 2400 accepted / 2136 syntax errors / 820 lexical errors,
zero JS/native C++98/WASM divergences, exact tokens/UTF-16 offsets/complete trees
and restored guest stack. This demonstrates the tested grammar subset, not full
POSIX execution or an unbounded-depth parsing guarantee.

This consumer slice is complete. The owner subsequently explicitly authorized
commit and push of the full MaiaOS set, including the guest artifact, sources,
tests, docs and published dependency pins. Next safe action after publication is
optional interactive simulator QA or a separately scoped execution feature. Pipelines, redirections and other word expansions remain
outside this slice; ls options and multi-file cat are not implemented.

Final boundary check: all 13 shell imports are identical to published HEAD; all
34 recursive MaiaOS dependency checkouts are clean. Principal MaiaC/MaiaJS dirty
files at that milestone were exclusively example artifacts (115/106), unstaged;
they are now published under the subsequent explicit authorization below.

## Subsequent owner-approved example artifact publication

The owner requested versioned generated examples for GitHub/mobile review.
Published heads are now MaiaC 5c282fe, MaiaCpp 426947f, MaiaJS 18a0115 and
MaiaGlob f14d86b; all four principals are clean. The C/JS READMEs record the
scoped output policy. Compiler implementations, grammars, guest sources, versions
and npm packages are unchanged; only examples, publication notes and gitlinks
change. MaiaJS's validation report records existing strict-Clang failures of
four legacy generated C examples, also failing in the former published versions.
No generated source was hand-repaired. Existing distribution executions pass.

MaiaOS consumes the new published pins locally. test:shell-glob and
test:shell-lvgl PASS after sync, with 2022 real LVGL flushes, 74011 kernel steps,
stable shell18/I/O2 memory pages and complete handle/stream cleanup. The earlier
full-build/equivalence evidence remains valid for identical compiler/source code.
Before the final publication approval MaiaOS main/origin was 10f1a34. The owner
has now authorized the full integration commit and push; earlier exclusions in
this historical record no longer apply to that reviewed set.
