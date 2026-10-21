# MaiaOS shell frontend integration handoff — 2026-10-20

## Current objective/result

### Approved directory navigation slice implemented — 2026-10-20

Owner explicitly approved `docs/planning/SHELL_VFS_DIRECTORIES.md`: opendir and
readdir imports/capabilities, NOT_DIRECTORY(-9), bounded snapshots, shell-local
cwd and ls/cd/pwd plus reference tests. The implementation approval excluded
publication; on 2026-10-21 the owner explicitly authorized commit and push of this
complete MaiaOS slice. Compiler changes, version bumps and npm remain outside
scope. This publication follows baseline `160befe`; its resulting commit and
remote synchronization are reported in the final chat outcome. The initial
audit was documentation-only and its pending-approval status is superseded.

Implemented only in principal MaiaOS:
- `runtime/maia-vfs.js`: typed file/directory handles, strict bounded directory
  snapshots sorted by UTF-8 bytes, private-home filtering, virtual mount/own-home
  directories, atomic size/quota/ambiguity errors, complete versioned entry
  packets and closeAll lifecycle cleanup. IndexedDB-hydrated views use the same
  directory implementation; no persistent cwd/directory metadata was invented.
- Host imports/capabilities: conditional exact opendir/readdir bindings, whole
  buffer validation before cursor changes, no unsupported-adapter fallback;
  process exit and explicit teardown close VFS handles. Main.js passes manifest
  openFiles (host cap 16) to memory/IndexedDB adapters and closes handles on traps.
- C++98 shell: real per-instance cwd (initial `/`), bounded logical absolute/
  relative path resolution with dot/dotdot (root-clamped), cd validates via
  opendir/close before changing cwd; no-operand cd selects its own home. ls yields
  under stream backpressure, validates packets, escapes controls/backslashes,
  appends slash to directories and closes its snapshot on EOF/error/exit.
  Path normalization has scratch space for cwd+operand, so a final 1023-byte
  path remains valid even when an intermediate append is removed by dotdot.
  Cat remains limited to its old operand. Help now lists eight commands.
- Updated shell manifest, reproducible shell.wasm, build/test commands, ABI,
  architecture, README and approved plan. New tests: VFS directories and actual
  shell WASM directory stress; expanded real LVGL session and production boot
  lifecycle tests. Parser/lexer sources, EBNF/generated headers and compilers
  are unchanged. No GUI/terminal moved to JavaScript; I/O remains real LVGL guest.

Verification PASS:
- `npm run build:shell -- --check-c89`: 1193137-byte WASM, strict C89 syntax check;
  pinned MaiaCpp -> C89 -> MaiaC/MaiaWASM produces all guest code.
- `npm test`: 38 tests; packet/cursor canaries, malformed UTF-8, bounded snapshots,
  isolation, typed handles/quotas/reuse, close cleanup, hydrated adapter view.
- `npm run test:shell-directories`: 1024 entries through 31-byte ring without loss,
  two isolated cwd instances, 1000 ls/cd cycles, exact 1023-byte normalized path
  bounds, denied capabilities, malformed packets, EOF during final ls and closed
  terminal while a snapshot is open; stable guest stacks and memories.
- `npm run test:shell-host` / `npm run test:shell-lvgl`: eight commands, existing
  editing/quote/syntax/error/bounds regressions, directory paths/escaped controls,
  1024-entry real LVGL output and 1000 repeat parses; shell 18 and I/O 2 pages stable,
  71111 kernel steps, no surviving VFS handles/streams. Latest LVGL 2136 flushes
  (render timing changes this count).
- `npm run test:shell-boot`: production boot functions with actual WASM/LVGL,
  25 launch/exit cycles, failed startup, manifest limits, unchanged URL, directory
  import trap with live handle, zero surviving windows/VFS handles/endpoints.
- `npm run test:io-streams` and `npm run test:lvgl-host`: previous streams +
  kernel/Calculator/Clock regressions PASS. JS syntax/diff whitespace PASS.
Local HTTP checks PASS: shell WASM/manifest, VFS adapter and browser main.js
return 200 and match current local bytes; server remains at localhost:8080.
All seven principal dependency repositories are clean, and EBNF/generated parser/
Regex headers were compared byte-for-byte against HEAD without differences.
Logs: `/tmp/maia-vfs-shell-build.log`, `/tmp/maia-vfs-directory-unit.log`,
`/tmp/maia-vfs-test-{shell-directories,shell-host,shell-lvgl,shell-boot,io-streams}.log`,
`/tmp/maia-vfs-other-apps.log`. Prior 5356-case JS/native/WASM differential baseline
remains unchanged; not rerun here because grammar/generated sources did not change.

Browser interactive/touch/fullscreen and native-device/MaiaWASMVM validation are
UNRUN. Directory adapter IndexedDB hydration used a storage fixture, not a real
browser persistence test. No POSIX options, symlinks, arbitrary mkdir/unlink,
spawning/pipelines or general cat are claimed. Initial input/word/terminal limits
remain unchanged. Publication of this feature is now explicitly authorized.
Compiler packages remain
1.6.0, and no compiler source or dependency pin changed.

Next safe action: owner refreshes simulator and checks `ls`, `cd /system`, `pwd`,
`ls`, `cd ..`, `cd` and `ls /home`.
Further shell development can broaden read-only cat path handling using the same
cwd/VFS authorization, with explicit behavior/tests before further API additions.
Publication verification (2026-10-21): unit, directory WASM stress, actual LVGL
shell session, boot lifecycle, streams and kernel/Calculator/Clock regressions
were rerun before committing. Logs: `/tmp/maiaos-directory-publication-*.log`.
Historical sections below describe earlier snapshots and are superseded here.

### Approved release synchronization + real shell/I/O slice — 2026-10-20

Owner approved the concrete stream/I/O proposal in
`docs/planning/SHELL_IO_VERTICAL_SLICE.md`, including additive stream imports,
capabilities, CLOSED(-8), actual C++98 I/O and the shell responsibility split.
Owner separately authorized recording/pushing the already-staged MaiaC1.6.0
release metadata and synchronizing MaiaCpp/MaiaJS/MaiaOS pins. That publication
scope originally excluded new UI/I/O code. The owner subsequently explicitly
authorized committing and pushing the entire listed MaiaOS change set (2026-10-20).
That later authorization now covers this simulator/I/O integration publication;
it does not authorize an npm release or version bump.

Published main commits, confirmed by live `git ls-remote origin refs/heads/main`:
- MaiaC32ebd46879e640d605ef8f56a21656d86a521ecd: package1.6.0, CC/WASM pins.
- MaiaCpp09db55c27dbade0fafa5dcb8af6f325558c60df6: only MaiaC gitlink.
- MaiaJSd5440b45d7919512c4e5b99038dfb0b93156aff9: only C/Cpp gitlinks.
- MaiaOS37e14b04a0b2c3711a684f033462fb3bf246ecc0: only MaiaCpp gitlink.
Principal Regexb66a74b, CC1c7bbc5, WASM7d82e4a, SQLb54bd26 unchanged.
All seven principal dependencies clean; only MaiaOS feature work is dirty.
All recursive checkouts match their recorded pins: C7, Cpp15, JS31, OS17.
All70 recursive gitlinks across these four consumers are ancestors of their
respective intended `origin/main` refs. No npm publication, further version bump,
history rewrite, stash or destructive synchronization was performed.

Automatic approval review REJECTED `./git_pull.sh` in MaiaCpp: it would perform
broad pulls/recursive --remote updates beyond the authorized pointer change.
User was informed. Safe alternative was explicitly fetching the intended origin
with `--no-recurse-submodules`, checking out exact published commits without
force, then committing only scoped pointers in dependency order. This succeeded;
there is no remaining approval blocker. Report this rejection/resolution briefly
in final, as required by developer instructions.

Publication validation: MaiaC `npm test` (43 groups) + `npm run compile:example`;
MaiaCpp `npm test`; MaiaJS `npm run test:full`; all PASS. Test-generated tracked
C/JS example outputs were backed up then restored to exact HEAD bytes, preserving
owner changes. Backups: `/var/folders/6p/871hys095mq5mm7078sqplx40000gn/T/maiac-160-test-generated-mym56n7b`
and `maiajs-160-test-generated-hzizpff3` under the same temporary root. The clean
published OS baseline was tested independently in ignored
`build/release-baseline-160-qe_5uyhy`: unit, shell-LVGL and kernel/Calculator/Clock
PASS. Logs `/tmp/maia-release-160-{maiac-tests,maiac-example,maiacpp-tests,maiajs-tests}.log`.
Pre-publication index/diff snapshots: temporary `maia-release-160-before-sync-hil7xyqo`.

Feature implementation included in the authorized MaiaOS publication:
- Simulator host layout: compact app toolbar, responsive bezel around the same
  1280x720 LVGL canvas, truthful runtime state, native fullscreen, collapsed
  diagnostics/custom-module controls, accessible focus. External controls keep
  Enter/Tab; no DOM OS widgets or alternate renderer. Three keyboard regressions.
- `runtime/maia-streams.js`: bounded copied-byte FIFO, process-local handles,
  quotas, partial transfers/backpressure, EOF/CLOSED, aliases and cleanup.
  `maia-host-imports.js` validates entire guest buffers before transfer and closes
  owned streams on exit; capabilities map exact stream imports.
- `apps/io/io.cpp`, manifest, README, `io.wasm` (21531 bytes): real C++98 guest
  owns LVGL terminal, ASCII canonical editing/history/caret and incremental UTF-8
  output decoding. Shell prompt remains shell-generated. Clear/home only.
- Shell now owns parsing/commands/VFS + stdin/stdout/stderr streams. It imports no
  gfx/events. Existing generated EBNF lexer/parser and bounded tree/word validation
  remain unchanged. Cat resumes across steps and cannot overrun output queues.
  `shell.wasm` is1185253 bytes. Builds use pinned MaiaCpp -> C89 -> MaiaC/WASM;
  optional Clang checks emitted C89 only, never builds the guest.
- Actual browser boot functions bind stdin0, stdout1, stderr2 against I/O3/4/5,
  then start I/O + shell in isolated memories while kernel remains scheduled.
  Stdout/stderr share an ordered terminal pipe via aliases, preventing prompt/error
  reordering. Startup failure/trap/exit cleans endpoints and I/O windows.
  I/O observes output EOF and renders final bytes before accepting further keys;
  this avoids a reproduced pending-Enter close race.

Verification PASS:
- `npm run build:io -- --check-c89`; `npm run build:shell -- --check-c89`.
- `npm test`:30 tests, including copied buffers/canaries, ownership, bounds,
  quotas, ring wrap, aliases, atomic boot rollback, peer closure and cleanup.
- `npm run test:io-streams`: actual I/O/shell WASM, fragmented UTF-8 and clear,
  long UTF-8 live-line bounds, EOF with queued Enter, canonical-input pressure,
  closed peer,18000-byte VFS cat through 31-byte ring, unterminated stdin EOF,
  oversized-input recovery,25 clean fresh-guest sessions on one reused broker.
- `npm run test:shell-host` and `npm run test:shell-lvgl`: actual kernel/I/O/shell,
  all six commands, quotes/comments/errors/unsupported/bounds, editing/history,
  inline caret,1000 repeats. Shell18 pages + I/O2 pages, stable stacks/memories,
  67969 kernel steps, all streams/VFS handles drained/closed. Latest real LVGL
  run2046 RGB565 flushes (time-dependent count).
- `npm run test:shell-boot`: actual production startup/cleanup functions evaluated
  in a Node reference harness with real guest WASM + real LVGL; failed I/O/shell
  startup cleanup and25 launch/exits with zero surviving windows/endpoints.
- `npm run test:lvgl-host`: kernel/Calculator/Clock still PASS.
- `npm run test:shell-equivalence`:5356 raw inputs,2400 accepted,2136 syntax,
  820 lexical errors, zero JS/native C++98/WASM differences in exact tokens,
  UTF-16 offsets and complete accepted trees; restored stack.
- JS syntax, diff whitespace checks; local HTTP200 for UI/main/CSS/stream runtime,
  I/O manifest and both guest WASM files. Served WASM bytes match local artifacts.
Logs `/tmp/maia-stream-{unit,guests,session-host,session-lvgl,boot,other-apps,equivalence}.log`,
`/tmp/maia-io-build.log`, `/tmp/maia-stream-shell-build.log`.

Browser visual/fullscreen/touch smoke is UNRUN. Browser skill setup/troubleshooting
retried; `agent.browsers.list()` returns[]. Do not use an unrelated backend or
claim screenshots/browser interaction. The running server at localhost:8080 serves
new files; owner can refresh, select Maia Shell and run it. The Node production
boot-function harness is explicitly not browser interaction verification.

Known limits: ASCII input/one-line history; terminal history resets at4096 bytes;
no general ANSI terminal, process spawn, general pipelines, POSIX conformance,
directory enumeration/cwd commands, native-device streams, MaiaWASMVM/fuel or
runtime memory enforcement. Dense Regex memo clearing remains measured but not
fixed; do not mix a Regex rewrite into this slice. Device work remains deferred.
No source changes were needed in principal compilers for this milestone.

Publication checks were rerun before committing: unit tests, actual stream guests,
kernel/I/O/shell with real LVGL, actual boot lifecycle and kernel/Calculator/Clock
regressions. Logs: `/tmp/maiaos-publication-*.log`. Git publication is now explicitly
authorized; the final chat report records its resulting commit and push outcome.
No compiler code, toolchain pins, release versions or npm packages change here.

Next safe action: owner reviews the refreshed simulator visually.
Then specify directory enumeration + shell-local cwd for ls/cd before implementing
those public VFS additions. Preserve all local feature changes and sources.

Historical sections below record earlier milestones; they are superseded where
this current section describes the approved I/O boundary and current commit IDs.

### Inline shell prompt/caret correction — 2026-10-20

Owner opened the integrated-browser simulator and reported the caret below the
`maia> ` prompt. Cause: prompt was in the output/history LVGL label while the
editable input/caret was in the next vertically arranged LVGL label.

Fixed only guest presentation: render prompt, edited text and caret together in
the input label; append the submitted prompt/command to history on Enter. The
display buffer is now 263 bytes (6 prompt +255 editable +1 caret +1 NUL), preserving
all existing input limits. No graphics ABI/platform layout changes, handwritten
parser/lexer, grammar/generator/compiler change or alternate GUI is involved.
Changed shell.cpp, regenerated shell.wasm, host/LVGL test expectations and docs.

Regression assertion fails against the old WASM with actual `|` versus expected
`maia> |`. After `npm run build:shell -- --check-c89` PASS, both
`npm run test:shell-host` and `npm run test:shell-lvgl` PASS: inline prompt/caret,
mid-line editing, history, all commands/errors/bounds, 1000 repeated parses,
stable restored stack and 18 memory pages. Real LVGL produced 1269 RGB565 flushes.
New WASM 1182705 bytes, SHA256
8aff50c34d878b3f7dbf6deaad480d6fb71b0290051fdfbfb630014fc4b70e67.
Logs /tmp/maiaos-shell-inline-prompt-build.log,
/tmp/maiaos-shell-inline-prompt-before.log (expected old-artifact failure),
/tmp/maiaos-inline-prompt-test-shell-host.log and
/tmp/maiaos-inline-prompt-test-shell-lvgl.log. git diff --check passes.

User confirmed actual browser launch before the fix. Agent browser discovery
still returns no available backend, so agent visual/browser interaction after
the correction is UNRUN; real LVGL rendering/keyboard guest tests above pass.
The already-running demo server serves the regenerated shell.wasm at the same
URL; refresh the page and relaunch Maia Shell MVP to load it.

main remains local commit 0be4de0. This follow-up is local/uncommitted (six files),
no new commit/push, versions or gitlinks. Previous MaiaCC commit is 176ea3b.
Next safe action is owner browser confirmation; no builds/tests remain active.

### Authorized local snapshot commits — 2026-10-20

The owner explicitly requested committing ALL reviewed pending files in MaiaCC
and MaiaOS. This snapshot records the complete local shell/LVGL integration,
generated comparison/runtime sources, collectors, fixtures, tests, benchmark and
engineering documentation. Generated files are included under that explicit
authorization; EBNF and reproducible generation commands remain authoritative.
The preceding sections below record historical task states, including earlier
uncommitted status. They do not describe this snapshot's final Git status.

Commit MaiaCC first (tests/docs only), then MaiaOS. This step authorizes local
commits; no push, npm/version change or submodule propagation is performed.
The published baseline is MaiaCC 2dcd96c / MaiaOS 306c1ee. Existing published
toolchain gitlinks are retained: the new MaiaCC delta changes no generator/runtime
implementation. Future publication/synchronization follows the ecosystem protocol.
The requested MaiaCC local commit is 176ea3b (five pending files); this MaiaOS
snapshot follows it without recording an unpublished dependency gitlink.

Precommit checks: `npm test` in MaiaOS passes 20 tests;
`npm test` in principal MaiaCC passes all 114 tests;
`node apps/shell/rtest.js --cpp` regenerates both legacy comparison backends from
EBNF and passes all 44 JS and 44 C++98 cases with complete accepted-tree parity.
The raw 5356-case differential run and phased measurements recorded below remain
the current results; production grammar/WASM are unchanged by this commit task.
The performance bottleneck is diagnosed, not optimized. Browser/device/VM limits
remain explicit. Local pre-regeneration backup:
/var/folders/6p/871hys095mq5mm7078sqplx40000gn/T/maiaos-precommit-_qzyy3fl.
Final staged review includes 41 MaiaOS files and no submodule pointer changes.
Both generated C++ comparison/runtime headers are byte-identical after the legacy
runner regeneration. The staged default whitespace check reports seven existing
trailing-space lines emitted by the JS template; exact generator output is
preserved rather than patched manually. Other staged whitespace checks pass when
that formatting category is excluded. No production grammar/WASM bytes changed.

### Speed difference — latest completed diagnosis

Owner clarified the concern is the large speed difference. The output-equivalence
answer did not measure speed. Added `npm run benchmark:shell-parser` and
`docs/SHELL_FRONTEND_PERFORMANCE.md`. The test-only WASM adapter now exposes
separate lex/parse/parse+collector/full operations and guest-side repeated loops;
`probe_run` retains the same behavior. No production source changed.

PASS phased measurements for 13 inputs, four modes, median five warmed samples;
build/startup/transport excluded, checksum/stack checks pass. Native Clang -O2;
WASM own MaiaCpp AST strict -> C89 -> MaiaC/MaiaWASM. All timed implementations
are UNINSTRUMENTED. Separate native instrumentation counts memo allocation bytes.
For 896 bytes (`echo x;` repeated 128 times), lexer medians: JS 0.355 ms, native
5.73 ms, WASM 323.7 ms. WASM parse alone 0.143 ms; parse+collector 0.320 ms.
Regex memo: 17920 allocations, approximately 166346000 cumulative bytes, not live
memory. From 16 to 128 commands: input grows 8x, memo bytes about 63x.

Separate actual guest malloc/calloc probe: warm 64 KiB malloc+free 0.0199 us,
calloc+free 126.9 us. The resulting ~1.94 ns/byte predicts ~322 ms clearing the
measured memo volume, close to 324 ms lexer latency. This is a diagnostic
cross-check/inference, not exclusive instruction-level profiling.

JS collector deep clones add their own cost. Full collection on that list is
JS 1891 ms, native 5.52 ms, WASM 324.5 ms. Therefore do not claim the complete
JS frontend is always faster; distinguish lexing, parsing and collector costs.
The measured lexer bottleneck does not demonstrate a grammar-recursion defect.
It also does not by itself profile every stage of complete MaiaCC self-hosting.

Core timing command `node scripts/benchmark-shell-frontends.mjs` PASS; allocator
probe separately PASS on the resulting module. Current command includes the same
allocator probe for future runs. Report/source/binaries:
/var/folders/6p/871hys095mq5mm7078sqplx40000gn/T/maia-shell-performance-nXNEe7
(report.json and allocation-report.json), /tmp/maia-shell-performance.log.
Discarded instrumentation attempts: explicit double integer-zero initializer
unsupported; later WASM counters did not validate. Final timed binaries use
unmodified Regex/libc and counters come ONLY from separate native build; do not
infer a proven compiler macro bug from the abandoned instrumentation.

After adapter split, `MAIA_SHELL_KEEP_BUILD=1 npm run test:shell-equivalence`
PASS again: all 5356 cases, 2400 accepted/2136 syntax/820 lexical errors, zero
JS/native/WASM differences, every WASM stack restored. Artifacts:
/var/folders/6p/871hys095mq5mm7078sqplx40000gn/T/maia-shell-equivalence-AmgZ3t;
log /tmp/maia-shell-performance-equivalence.log. Syntax/diff checks pass.

Only OS test adapter, new benchmark script, package command and documentation
changed for this task. main 306c1ee; all work local, unstaged, no commit/push,
gitlink/version/npm changes or upstream edits. Earlier unrelated work preserved.
No active jobs or subagents. Next scoped performance work should reduce dense
memo allocation/clearing in its principal owner while preserving Regex ordering,
cycles/assertions/resource contracts and differential tests. Guest zero-fill
optimization can reduce its cost but does not remove quadratic memo volume.
Performance has been diagnosed, NOT yet optimized or fixed.

### Previous generated lexer/parser equivalence task

Owner requested checking actual JS/C++ equivalence, then clarified that no
recursion reproducer is known and the former manual lexer may have been involved.
Proceed with generated frontends; the manual lexer is not the current runtime.

Added `npm run test:shell-equivalence`: same raw UTF-8 inputs -> regenerated JS,
native strict C++98, and generated C++98 -> MaiaCpp AST strict -> C89 ->
MaiaC/MaiaWASM. Test adapters contain transport/observation only; guest matching,
parsing, Regex, allocation and collector remain real. Host imports are restricted
to env memory primitives; graphics callbacks throw if unexpectedly invoked.

PASS 5356 unique deterministic inputs (seed 0x4d414941): 2400 accepted,
2136 syntax failures, 820 lexical failures; ZERO discrepancies among all three
paths. Compared token types, raw values, UTF-16 offsets, lexical error positions,
partial token streams on lexical errors, accepted complete tree hierarchy/rules/
terminal values. Every WASM call restores its stack. Test guest ends at 22 pages.
Adapters have 4096 input bytes, 2048 tokens, 8192 nodes; production limits remain
255 editable bytes, 32 tokens, 1024 tree nodes and unchanged guest at 18 pages.
Generated/mutated cases include ASCII controls/NUL, Unicode boundaries, operator/
keyword/assignment pairs, compound constructs, quotes, truncations, 1024-byte
words and nesting through 128. This is finite differential evidence, NOT a proof
of equivalence on every input, identical unbounded stack budgets or POSIX
correctness. Known shared grammar defects and JS deep-stack limit remain.

Commands: `MAIA_SHELL_KEEP_BUILD=1 npm run test:shell-equivalence` PASS;
`npm run test:shell-parser` PASS (52 cases + 15 recursion profiles);
`npm test` PASS 20; `npm run test:shell-host` PASS 1000 repeated commands;
`npm run test:shell-lvgl` PASS 1000 commands, 1252 real RGB565 flushes and stable
stack/memory (18 pages). Log: /tmp/maia-shell-equivalence-test-shell-lvgl.log.
No active builds/tests remain. Interactive browser/device/VM not run this task.
Artifacts/report: /var/folders/6p/871hys095mq5mm7078sqplx40000gn/T/maia-shell-equivalence-nmY7Y6.
Logs: /tmp/maia-shell-equivalence.log, /tmp/maia-shell-equivalence-regression.log,
/tmp/maia-shell-equivalence-unit.log. First two adapter setup attempts failed
because the host requires graphics/VFS tables; corrected in the final run, not a
parser failure. Failure artifacts retained; do not confuse old attempts with PASS.

Changes scoped to OS tests, package script and documentation only. EBNF hash
915866d6508cbee10f16dd4c40ac14ef5a481fc89ec02afce425834620e7be25
and shell.wasm hash below unchanged. No generator/compiler/source modifications,
new public APIs, commits/pushes or submodule changes. main remains 306c1ee;
existing unrelated dirty user/integration work preserved. No agents used.
Next action: owner review or a concrete regression if one is discovered; no
reproduced production recursion defect remains to fix from the available input.

### Recursion investigation (subsequent owner report)

The owner reported excessive shell grammar recursion without an input or trace.
The owner later said no input/trace is known (see latest result above).
No production fix has been made for this report.

The raw generated-parser suite now has 52 JS/native C++ parity cases, including
the deepest complete subshell and incomplete prefixes within the guest's 32-token
budget. A separate generated JS rule profiler covers words, lists, pipelines,
nested subshells and incomplete prefixes at 8/32/128 sizes. Flat inputs stay at
11 active parse-method calls; nested depth is 7*n+11. No active same-rule/same-
position reentry was detected, and rule attempts remain linear in these cases.
This is measured coverage, not proof for every possible input.

`npm run test:shell-parser`, `npm run test:shell-host` and
`npm run test:shell-lvgl` all PASS after adding these regressions. Real LVGL:
1282 flushes, 1000 repeated parses, stable restored stack and 18 memory pages.
No build needed: production EBNF, generator and guest are unchanged.

Unbounded JS parsing does have a stack-dependent limit: fresh default Node
process accepts 512 nested subshells and rejects 1024 with an ordinary EOF syntax
error. Instrumentation adds frames and lowers the threshold, so its observed
512 rejection is NOT the uninstrumented limit. A warmed process can differ.
At 1024 levels, fresh Node with --stack_size=256/512/984 rejects while
--stack_size=2048 accepts, confirming dependence on the host call-stack budget.
Do not mistake this for demonstrated infinite recursion or claim it is fixed.
Measurements/logs and before-test copies: /tmp/maia-shell-recursion.
Next: obtain the reported reproducer and locate its phase before changing EBNF
or proposing generator implementation changes. No cross-repository edits,
commits, pushes, API changes or resource-limit increases for this investigation.

### Previous integration result

The owner clarified that the missing generated lexer/parser integration was the
problem and explicitly requested implementing it. The integration is COMPLETE
locally: raw input -> generated C++98 lexer -> generated parser -> tree/command
validation -> existing six-command execution through LVGL/events/VFS/process.
Read AGENTS.md and SHELL_PARSER_INTEGRATION.md before continuing. No agents used.

No active builds/tests remain. Browser interaction is unrun because the browser
backend list is empty; actual LVGL-WASM rendering passed under Node.

## Verified state

- `main` HEAD `306c1ee`, local integration changes only; no new commit/push for this
  task. Prior compiler/self-host publication remains complete and unchanged.
- Local MaiaCpp pin `2998aa8` and all nested dependencies are clean/aligned.
- Build: `npm run build:shell -- --check-c89` PASS; own compilers generate guest.
  Clang is optional syntax-only validation. Production build is Node/Maia only.
- `npm test`: 20 pass; shell grammar 32 valid / 9 invalid + 2 declared gaps;
  `test:shell-parser`: 48 raw JS/native C++ cases with complete tree/token parity;
  `test:shell-host`:six commands, editing, bounds/errors and 1,000 parses pass;
  `test:shell-lvgl`:same checks, 1,000 parses and 1,253 real RGB565 flushes pass;
  `test:lvgl-host`:kernel/Calculator/Clock actual LVGL regressions pass.
- Memory 18 pages stays fixed; stack restored; manifest remains 32 pages.
- WASM 1,182,597 bytes, SHA256
  0519cc85a3da21fd8f57b110a150bcc2ec3a7c9be8a785d197788842997d84a0.

## Important implementation contracts

EBNF is unchanged. Generated runtime files stay under apps/shell/generated.
Never hand-edit them or reinstate the handwritten tokenizer/operator/keyword
classification or NAME matching. The shell collector is per parse, uses generated
checkpoint/restore semantics, no-op abort after restore and sticky capacity
failure. Backing arrays are compiler-owned; do not reintroduce fixed addresses.
Quote removal and execution validation use generated tree nodes, not a second
parser. Compound execution remains unsupported and is rejected before dispatch.

Host bindings implement existing MaiaC libc memory primitives and guest allocator
forwarding only; no new MaiaOS syscalls. LVGL/VFS/event architecture is preserved.
The old static global collector caused unsupported direct global-struct access
in MaiaC; per-call lifetime is appropriate here and matches the REx adapter.

An early GUI stress test forgot LVGL ticks and exhausted the original 64 KiB pool.
That test scheduling error is FIXED. All1000 assertions remain; tick after guest
events matches the platform. A 256 KiB trial was reverted; original lv_conf.h and
main.c bytes are preserved. Do not resurrect the abandoned budget increase from
older failure logs. Actual original-config LVGL PASS is authoritative.

## Preservation and next safe action

Pre-task 97-file snapshot:
/tmp/maiaos-shell-integration-before-inr07w6i/manifest.json.
15 existing files intentionally changed; 82 unrelated baseline files preserved.
New implementation/test/docs files are local. Existing user shell/UI work was
not discarded or swept into commits. Publication must review the existing MVP
prerequisites too; do not publish a partial slice that omits its host/UI support. Staging empty; no npm/version/history work.
See /tmp/maiaos-shell-integration-final-evidence.json and the integration report.

The requested integration needs no further code work. Later actions may include
interactive browser verification, review/publication if explicitly authorized,
and scoped grammar/POSIX/execution improvements. Known separator/reserved-word/
IO_NUMBER gaps remain documented; do not claim POSIX shell completeness.
