# MaiaOS shell frontend integration handoff — 2026-10-20

## Current objective/result

### Latest checkpoint — 2026-10-22, pipeline output composition validated locally

Owner explicitly approved the exact SHELL_PIPELINE_OUTPUT_REDIRECTION.md contract
and implementation, excluding commit/push/npm/versions. The feature is implemented
in MaiaOS only; main/HEAD remains published baseline `09b566b`. No dependency
source, gitlink, package version, cat worker or I/O artifact changes. The earlier
preparation checkpoint below is historical; its pending-approval status is now
superseded.

Implemented: generated-tree validation permits exactly one last-stage stdout
redirect; quote-aware MaiaGlob still expands the target to one word before open.
The shell validates commands/paths/plan bounds and checks stream 3 is unbound
before opening a target. Existing flags 14/22 implement create/truncate/append.
The target is shell-local and never enters argv. Kernel plan v2 adds a fixed
bounded last-child -> owner:3 pipe and a runnable owner after startup acknowledgments.
Workers retain v1 argv, read-only capabilities, separate memories and private
handles. Existing plan v1 remains supported. process.pipeline gates the new
owner-only pipeline_cancel import; the kernel owns rollback and acknowledged
endpoint cleanup before final wait/reap. No new capability or VFS API was added.

The shell drains/retains partial VFS writes, yields on -6, cancels on failure,
preserves accepted prefixes, and closes/reaps before returning a terminal prompt.
A successful target open can truncate even if launch later fails; output is not
transactional. Launch/trap/cancel/owner-exit cleanup includes acquired owner
endpoints; collisions never cause the kernel to release an unowned endpoint.
The shell must yield immediately after submitting a pipeline: integration caught
an initial same-step read before startup bindings existed. That bug is fixed;
negative binding/transport tests guard the related cleanup cases.

Changed source areas: apps/kernel/processes.hpp; apps/shell/shell.cpp,
shell-pipeline.hpp, shell-glob.hpp; runtime controller/transport/import/capability
mapping; browser boot cancellation forwarding. Updated contracts/ABI/architecture/
README and tests. Built artifacts: kernel.wasm 40366 bytes (two initial pages),
shell.wasm 1268305 bytes (18 initial pages). kernel.js loader remains identical;
cat.wasm/io.wasm and generated grammar/parser sources remain unchanged. All guest
builds use the repository's published MaiaCpp -> MaiaC -> MaiaWASM chain.

Verification PASS (logs outside Git, /tmp/maiaos-output-*.log):
- `npm run build:kernel -- --check-c89` and
  `npm run build:shell -- --check-c89`: strict C89 checks and actual WASM builds.
- `npm test`: 52 passed, zero failed; includes cancel identifier validation and
  manifest-request/host-grant enforcement for the additive import.
- `npm run test:kernel-processes-native`: native C++98 ASan/UBSan,
  8192 malformed packets and 100 v1 + 100 v2/completion/cancel lifecycles.
- `npm run test:kernel-processes`: real WASM v1/v2 ownership, malformed/permission
  checks, owner runnable policy, occupied-owner rejection, immutable v1 argv,
  short wait atomicity, cleanup retry/ack, cancel during START/PIPE/running/
  completion, trap, collisions, parent exit and orphan/full quota reuse.
- `npm run test:pipeline-workers`: actual independent cat WASM memories,
  256KiB binary data through 31-byte pipes including v2 owner return pipe,
  cancellation/recovery, failed spawn/trap/parent exit and no surviving resources.
- `npm run test:shell-pipelines`: production boot/scheduler functions with real
  kernel/shell/cat/I/O/LVGL, truncate/append, relative/private/quoted/glob targets,
  two/four stages, binary output, same-file truncation, empty/missing input,
  prelaunch rejection, worker profile denial, partial writes/-6, real 1MiB quota,
  accepted failure prefix, stream read error, descriptor collision preservation,
  late close error and repeated cleanup before prompt. Negative forms additionally
  assert zero group submissions. This is Node integration, not browser interaction.
- `npm run test:shell-equivalence`: 5356 raw inputs, exact JS/native C++98/WASM
  tokens/UTF-16 offsets/complete trees and restored WASM stack.
- `npm run test:shell-redirection`, `npm run test:shell-files`,
  `npm run test:shell-glob`, `npm run test:shell-directories`,
  `npm run test:shell-boot`, `npm run test:io-streams`,
  `npm run test:shell-lvgl`, `npm run test:lvgl-host`: all passed. The old echo
  pipeline rejection now checks the appropriate unsupported-command diagnostic;
  it still verifies no output mutation and never uses a fake pipeline executor.
- `git diff --check`: passed.

Browser interaction remains pending because the supported in-app browser was
unavailable in this session (see preparation note); production boot exercised
under Node/LVGL does not replace that check. Physical-device/MaiaWASMVM execution,
input/descriptor redirection, general exec/jobs and wc remain outside this slice.
The next safe action is interactive simulator verification and owner review of
this uncommitted slice. No commit/push, version or npm action is authorized.


### Next-slice preparation — 2026-10-22, after published pipelines

User requested proceeding with simulator validation and pipeline stdout
redirection. Published baseline is main/origin `09b566b`; the working tree was
clean at task start. No source, binary, dependency, version or npm changes in
this preparation step. Added the reviewable proposal
`docs/planning/SHELL_PIPELINE_OUTPUT_REDIRECTION.md`; its exact public additions
are NOT yet approved or implemented. AGENTS.md requires approval before public
API/execution-model edits. Proposed additions: backward-compatible plan v2,
owner-only pipeline_cancel, kernel-owned return pipe on owner stream 3, and
runnable owner draining via existing VFS APIs. Cat stays read-only and I/O owns
LVGL. Consult the proposal for exact layout, ownership, failure and cleanup rules.

Validation in this step: `npm run test:shell-pipelines` PASS again with actual
production boot functions, kernel scheduler, generated shell AST, MaiaGlob,
separate cat workers and I/O/LVGL (33 flushes). Log outside Git:
`/tmp/maiaos-pipeline-composition-baseline.log`. No new feature was tested.
The existing server responds at http://127.0.0.1:8080/platform/desktop-web/index.html
with title "MaiaOS · Simulator". Attempting another server found EADDRINUSE; the
running server was preserved. In-app browser setup reported
"Browser is not available: iab"; supported browser listing returned []. Browser
interactive validation was NOT performed and remains pending. Do not substitute
the Node/LVGL harness for that claim or bypass browser-skill restrictions.

Next safe action: obtain approval for the concrete proposal's public changes,
then implement and test the bounded pipeline-output composition. No commit/push
authorization for these new changes has been requested or granted. Prior pipeline
publication authorization is already fulfilled by 09b566b.

### Publication checkpoint — 2026-10-22

The owner explicitly authorized commit/push of the complete validated pipeline
slice, including the approved contract and kernel.wasm/kernel.js/cat.wasm/
shell.wasm artifacts. This supersedes the publication exclusions in the earlier
local-validation notes below. This commit records that tested snapshot in MaiaOS
only; compiler/library sources and gitlinks are unchanged. No new version, npm
package or history rewrite. Generated runtime artifacts are explicitly versioned
for GitHub/mobile review alongside their sources and reproducible build commands;
no caches or temporary test output are included.

All functional checks recorded below already passed on this snapshot. Publication
changes only this status documentation; no duplicate full-suite run is needed.
Baseline before the pipeline commit: main/origin 4783c5d. After commit/push verify
origin/main matches HEAD and the working tree is clean. The next feature contract
remains pipeline+redirection composition or general programs; neither is silently
added by publication. Browser-interactive/device validation remains separate.


### Latest checkpoint — 2026-10-22, pipeline implementation validated locally

Owner explicitly authorized the tested redirection commit/push and the concrete
pipeline contract implementation, excluding pipeline commit/push/npm/versions.
Redirection is now published as main/origin 4783c5d. An initial combined publish
command was rejected by automatic review because it included the unapproved
pipeline proposal file; that command did not run. The safe scoped redirection
commit excluded that file and pushed successfully. No pipeline source/artifact
or contract has been committed/pushed. No version/npm/history change.

The approved pipeline slice is implemented in MaiaOS only. Kernel C++98 owns
16 process slots, four group slots, boot PIDs, resource/identity validation,
reserving <=128 worker pages, deferred startup, round-robin scheduling, exit
aggregation, rollback and reaping. Trusted host classes only move bounded binary
packets, instantiate the kernel-selected package and apply kernel stream actions.
Browser boot no longer allocates PIDs or chooses runnable policy in JavaScript.
I/O owns the unchanged real LVGL terminal/events. Kernel halt tears down its host
instances; stale asynchronous starts cannot enter a replacement kernel.

The generated shell Pipeline/SimpleCommand AST drives quote-aware MaiaGlob
expansion before submitting a plan. Two-to-four independent cat.wasm workers get
immutable copied argv, private memories/handles and explicitly authorized caller
VFS identity. The first cat requires files; later operand-free cat consumes stdin.
Only cat is whitelisted. At most 12 total expanded words, <=95 bytes each including
normalized absolute file paths; reject over-limit paths before launch. Pipeline
redirection composition, general exec/jobs/options/other stages remain unsupported.
Existing simple-command > / >> and all builtins remain functional.

Implementation paths: apps/kernel/processes.hpp + kernel.cpp/kernel.json;
apps/cat/{cat.cpp,manifest.json,cat.wasm,README.md}; apps/shell/shell-pipeline.hpp,
shell.cpp/shell-glob.hpp/manifest/shell.wasm; runtime/maia-kernel-processes.js,
maia-pipeline-transport.js, host-imports/capabilities/streams; browser main.js;
new build/test scripts, updated old fixtures, package test entries and docs.
Kernel POD lowering declares existing env.__malloc/__free bridges; kernel
manifest explicitly requests memory.alloc/free. The fixed cat package profile
is read-only and its manifest cannot silently exceed kernel-reserved resources.
Builtin-only fixtures fail if their unused pipeline imports are invoked; dedicated
suites use actual kernel, workers, production boot functions and real I/O/LVGL.

Verification PASS (final functional sources):
- npm run build:kernel -- --check-c89: own published MaiaCpp -> strict Clang C89 ->
  MaiaC -> kernel.wasm, 38644 bytes, two initial pages.
- npm run build:cat -- --check-c89: actual worker WASM, 4240 bytes, two pages.
- npm run build:shell -- --check-c89: actual shell WASM, 1266970 bytes, 18 pages.
- npm test: 50 passed, 0 failed.
- test:kernel-processes-native: native C++98 ASan/UBSan, 4096 malformed packets
  and 100 group lifecycles, no sanitizer errors.
- test:kernel-processes: actual WASM policy, 100 group cycles, malformed packets,
  wait ownership/bounds, failed launch/trap/parent cancellation, completed orphan
  reaping/full quota reuse and stale boot acknowledgments after slot reuse.
- test:pipeline-workers: four distinct actual worker memories, 256KiB binary
  transfer through 31-byte pipes, private delegation/foreign denial, literal
  metacharacters, empty files/EOF, downstream early close, 50 repetitions,
  failed second launch, trap and parent cancellation during an in-flight start.
- test:shell-pipelines: production browser boot/scheduler functions, actual kernel,
  generated shell AST/MaiaGlob, workers, io.wasm and real LVGL with 31-byte pipes;
  relative/quoted/glob/private paths, four stages, 25 repetitions, unsupported-form
  atomicity, rejection/recovery of a worker manifest exceeding its read-only
  profile, existing redirection, kernel shutdown with pending worker startup,
  zero surviving instances/windows/files/endpoints. Last run: 33 actual flushes.
- test:shell-boot: 25 sessions + failed startup and import trap cleanup while
  keeping the real kernel alive; final full teardown remains empty.
- test:shell-files/glob/directories/redirection/lvgl, test:io-streams and
  test:lvgl-host PASS. Calculator/Clock/kernel UI remain functional.
- test:shell-equivalence: all 5356 JS/native C++98/WASM inputs exactly match tokens,
  UTF-16 offsets and full trees; guest stack restored. EBNF/generated files unchanged.
- git diff --check PASS.
Logs: /tmp/maiaos-pipeline-{kernel-build,kernel-tests,native,workers,unit,boot,
final-regressions,gui-apps,streams,parity}.log and /tmp/maiaos-shell-pipelines.log.

One boot-ack identity bug found during development caused repeated actions and
host test OOM; corrected by separating action recipient from the stable boot
owner PID. Bounded test iteration guards and stale-slot tests now lock this down.
All final tests above passed after the correction; do not cite the failed run as
current. Existing kernel.wasm/kernel.js outputs live under ignored generated/;
future authorized publication must explicitly include those reproducible artifacts
for the owner's mobile/GitHub inspection, alongside cat.wasm and shell.wasm.
No cache/temp build files should be committed. All owning compiler/library
repositories and consumed gitlinks remain unchanged by this MaiaOS-only slice.

Next safe action: obtain explicit publication authorization for this fully tested
pipeline set, including its contract and generated runtime artifacts. No further
architecture approval is needed for the implementation already authorized. A
subsequent extension (general programs or pipeline+redirection) needs a concrete
separate contract. Interactive in-app browser and physical-device tests were not
run; Node native-WASM with actual LVGL is the reference integration evidence.


### Current checkpoint — 2026-10-22, stdout redirection complete locally

The owner said "Pode seguir" after both publication and precise redirection
contract requests. Authorized publication is complete: MaiaCpp fd6730f, MaiaJS
58e5aff, MaiaGlob b82c0ce, MaiaOS 7b06d44. No versions/npm/history rewrite.
All principal dependency repositories are clean. MaiaOS recursively consumes
published origin/main ancestors; all 34 initialized gitlinks are aligned. The
previous dirty nested MaiaGlob/maiacpp checkout has been resolved by consuming
the published parent pin, without reverting user work.

Third slice implemented locally: single simple-command stdout > / >>, interpreted
from the unchanged MaiaCC-generated AST; quote-aware MaiaGlob target expansion,
ambiguous-target rejection before open, flags14/22, cooperative partial-write
queue, accepted-prefix failure cleanup, terminal stderr/prompt and EOF/exit/trap
cleanup. New existing-capability request vfs.write; browser already explicitly
grants it. No new import signature/status. The actual shell WASM is 1261455 bytes.

Reference VFS adds approved APPEND=16, shared MaiaVfsStore records with private
adapter authorization/handles, 4096-byte writes, 1MiB files, 8MiB/4096 writable
records, atomic quota rejection and path/directory conflict checks. One browser
store/DB hydration/persistence queue, coalesced pending record updates, legacy
kernel-home migration and explicit asynchronous failure reporting. Store DB
lifetime is the browser boot lifetime, not each process exit. No durability claim.

Verification PASS:
- npm run build:shell -- --check-c89 (published own Cpp -> C89 -> MaiaC/WASM).
- npm test: 47 passed / 0 failed.
- npm run test:shell-redirection: binary concatenation, truncate/append, target
  positions/quotes/glob/ambiguity, capabilities, private/readonly paths, partial
  writes/retries, prefix errors, EOF/exit, cleanup and stable guest stack/memory.
- test:shell-files, test:shell-glob, test:shell-directories, test:shell-boot,
  test:shell-lvgl, test:io-streams, test:lvgl-host all passed. Boot includes a real
  import trap with two open redirection/cat files and host teardown releasing both.
- Actual LVGL: 2343 flushes, 75490 kernel steps, shell18/I/O2 pages stable.
- test:shell-equivalence: 5356 exact JS/native C++98/WASM tokens/UTF16 offsets/trees;
  2400 accepted, 2136 syntax errors, 820 lexical errors; stack restored.
- test:shell-grammar and test:shell-parser passed; generated frontend unchanged.
- git diff --check passed; submodule foreach recursive origin/main ancestry passed.
Logs: /tmp/maiaos-redirection-{build,unit,functional,regressions,boot,lvgl,parity}.log.
No interactive browser/device test or MaiaWASMVM correctness claim.

Files for this local third slice: shell.cpp/shell-glob.hpp/manifest/shell.wasm,
maia-vfs.js/new maia-vfs-store.js/host-imports, browser main lifecycle, updated
boot/LVGL tests, new tests/vfs-write.test.js and scripts/test-shell-redirection.mjs,
package test command, README/ABI/architecture/planning docs. Changes are uncommitted
and unpublished; existing authorization covered the prior reviewed first two
slices and propagation. Obtain explicit publication approval for this ready set.

Fourth slice has a concrete review proposal in planning/
SHELL_PIPELINE_PROCESS_CONTRACT.md: kernel-owned process table, bounded group
spawn/wait, scheduler/transport actions, restricted separate cat worker instances,
explicit caller-home delegation, quotas, rollback and real LVGL acceptance tests.
No pipeline/kernel/worker source has been changed. Obtain approval of these new
interfaces and delegation before implementing; never replace kernel lifecycle
policy with a JavaScript command executor. Pipeline+redirection composition is
explicitly outside the proposed initial pipeline slice. The MaiaRegex dense memo
performance concern from the full bootstrap remains separately documented in
MaiaCpp docs/LEGACY_C89_DIAGNOSTICS.md; correctness passed, optimization not done.


### Active next steps — owner-approved order (2026-10-21)

Owner explicitly approved: multi-file cat; fix four legacy emitted-C diagnostics
in the owning MaiaCpp; define output redirection write/permission/error contract;
then implement pipelines with actual processes/streams. Do not change architecture
or invent public APIs. Exact new host contracts must be reviewed before changes.
No blanket publication/npm/version authorization is inferred from implementation.

Multi-file cat is implemented locally and passed strict C89 build and functional
regressions (see planning/SHELL_CAT_MULTIPLE_FILES.md): 38 unit tests, actual files/
glob/directories/I/O/boot/LVGL/app regressions; one handle, exact bytes, continued
errors, EOF and peer-close cancellation. Actual LVGL: 2049 flushes, 74557 kernel
steps, shell18/I/O2 pages. User baseline main is now 9efca1d with published 1.6.1
suite dependencies. Preserve the pre-existing dirty nested MaiaGlob/maiacpp pin
(426947f -> 1a15d4c); the principal MaiaGlob itself is clean. Production shell
build uses its own published MaiaOS/maiacpp, with committed MaiaGlob frontend and
runtime sources. No generated parser or library code was patched. Next action:
correct legacy printf declarations and void fallthrough emission in principal
MaiaCpp, with regressions before regeneration/publication. Full shell parser
parity was previously verified and EBNF is unchanged.


### Completed local validation — 2026-10-22

The first two requested slices are implemented and locally validated. Principal
MaiaCpp fixes printf declarations, sanitized void fallthrough guards and C89
late-declaration regions, preserving initializer order and generated AST identity.
New regression compiler/tests/test-legacy-c89-output-contracts.js is in npm test.
Four original native C++98 fixtures match emitted C89 and actual WASM. Two stale
classes/casts reference outputs were corrected from independent original native
C++98 execution; the new regression locks all four representations together.
No input example checks were removed. Tracked example artifacts were regenerated
for the owner's GitHub/mobile review policy.

Principal MaiaCpp: npm test PASS; targeted contracts PASS; example build_all and
run_all PASS 11/11. Full check:maiaCC-selfhost-wasm PASS: three stable generations,
REx/XML/sample/WAT/shell XML plus C++/JavaScript byte parity, invalid-input checks,
stack restoration and 24 actual memory growths. WAT frontend isolated timing was
1671746 ms, status 0, 143711 XML characters. Correctness passed; substantial regex
memo initialization costs remain a performance concern, not a proven recursion
failure. Added phase timings for future bootstrap diagnostics. Exact result logs:
/tmp/maiacpp-legacy-c89-final-suite.log, /tmp/maiacpp-legacy-examples-final.log,
/tmp/maiacpp-legacy-selfhost.log. Principal MaiaCpp source/artifacts are unpublished;
MaiaOS has not consumed the unpublished compiler through a local checkout.

Owner approved publication/propagation and the presented redirection contract
on 2026-10-22 ("Pode seguir"). MaiaCpp fd6730f, MaiaJS 58e5aff and MaiaGlob
b82c0ce are published. MaiaJS test:full passed: 379 unit tests, 11 C++ and 11 JS
examples, 48 course cases and distribution integration. MaiaGlob generation,
sanitizers, 10638 native/WASM and 10621 frontend comparisons passed.
MaiaOS consumed the published pins; strict C89 rebuild and shell files/glob/LVGL
regressions passed: 2064 flushes, 74557 kernel steps, shell18/I/O2 pages.
Redirection backing-store work has started locally outside this cat commit;
the exact approved contract is planning/SHELL_OUTPUT_REDIRECTION.md. Pipelines require a further
kernel-owned process lifecycle contract: current kernel.cpp has no process table
or guest spawn/wait API, and the reference browser currently starts WASM instances.
Do not implement pipelines by silently assigning kernel policy to host JavaScript.
Next safe action: publish the authorized cat snapshot, then implement and
validate redirection. No new version or npm release was performed. Current
publication authorization covers the reviewed first two slices and propagation;
redirection publication will require separate approval once code/tests are ready.


### Current publication — full MaiaOS shell integration authorized

The owner explicitly accepted commit and push of the complete MaiaOS set after
reviewing its Git status. This approval supersedes the earlier exclusion of
MaiaOS publication described in the historical checkpoints below.

This commit records MaiaGlob as a published submodule, the published MaiaCpp pin,
quote-preserving guest filename expansion, multi-file/directory ls, read-only
absolute/relative/UTF-8 cat, the built shell.wasm, build/test scripts and docs.
Generated shell and pattern frontends remain MaiaCC-owned. Existing VFS/stream
imports and I/O/LVGL responsibilities are preserved; no ABI/version/npm change.

Relevant validation is already complete and unchanged by this publication:
strict C89 shell build; 38 unit tests; shell grammar/parser; 5356 exact JS/native/
WASM frontend comparisons; shell-glob/files/directories/streams/boot/host/LVGL
and kernel/Calculator/Clock tests. The last post-sync real LVGL run passed with
2022 flushes, 74011 kernel steps and stable shell18/I/O2 memory pages. All 34
recursive gitlinks are published and initialized; owner repositories are clean.
Shell WASM SHA256 remains
616381ca8730b8a42afa7ef28888c4b7697324403b20972139d7cce7e1004732.
No source/build changes or duplicate full-suite run are needed solely to commit
this validated snapshot. Parent before publication: main/origin 10f1a34.

Next safe action after publication is optional interactive simulator QA or the
next separately scoped shell feature. Browser interaction was not rerun; full
POSIX execution, pipelines, redirection, ls options and multi-file cat remain
outside this slice. No outstanding publication approval remains for this set.


### Earlier checkpoint — owner-approved example publication (2026-10-21)

The owner explicitly requests committing generated examples for GitHub review,
including from a mobile device. This supersedes the earlier decision to leave
those artifacts dirty; it does not authorize publishing the pending MaiaOS
shell/cat feature. Both compiler READMEs now record the scoped preference for
tracked example outputs, not arbitrary ignored caches/build scratch files.

Published main commits: MaiaC 5c282fe (115 artifacts + README), MaiaCpp 426947f
(published C pin), MaiaJS 18a0115 (106 artifacts, README, validation report and
C/Cpp pins), MaiaGlob f14d86b (published Cpp pin and status note). All four owner
repositories are clean; no compiler implementation, grammar, API, version or npm
package changed. Code-fix milestones in the next section remain valid.

Artifact verification: 77 actual WASM modules validate; all 58 modified WAT files
assemble through each owner's MaiaWASM to byte-identical paired WASM; 82 JSON
manifests parse. Existing distribution execution passes: MaiaC 17/17 examples
(one non-test directory skipped), MaiaJS 11/11 C++ + 11/11 JS ports. After pointer
sync: MaiaCpp npm test PASS; MaiaJS npm test 379/379 and test:suite:run PASS;
MaiaGlob test-wasm (10638 cases/18 walker scenarios/500 repetitions) and
check-generated PASS. Full source builds were already validated; unchanged
compiler implementations do not need timestamp-only regeneration for this
artifact-only commit.

Extra strict Clang syntax checking fails on four legacy emitted C examples,
and also on each corresponding previously published file: functions.c returns
a void expression and omits printf declarations; classes.c, inheritance.c and
casts.c omit printf declarations. Their actual Maia Suite distributions pass,
but these examples are not strict-C89 conformance evidence. No generated output
was hand-edited. See maiajs/docs/EXAMPLE_ARTIFACT_VALIDATION.md; a future owner
compiler fix must add regressions and regenerate source normally.

MaiaOS local pointers now record MaiaCpp 426947f and MaiaGlob f14d86b.
`npm run test:shell-glob` and `npm run test:shell-lvgl` PASS after synchronization:
2022 actual LVGL flushes, 74011 kernel steps, shell18/I/O2 pages stable, drained
streams and closed handles. No rebuild is needed for unchanged compiler and
guest sources. Main/origin remains 10f1a34; pending shell/cat sources, tests and
docs are preserved locally. No MaiaOS commit/push, npm release or version change
in this publication.


### MaiaGlob integration — verified implementation milestone (2026-10-21)

Objective: reusable generated-pattern MaiaGlob library and quote-preserving
filename expansion before shell dispatch, with multiple file/directory ls
operands. This is the owner's approved DESIGN.md, not a replacement architecture.

Implementation commits validated before the artifact-only publication below:
- MaiaC e173259: indexed aggregate copies (earlier f7f76bd), member-array/pointer
  strides (196f8ba), sizeof dereferenced structs (e173259). Focused regressions,
  full bundle + 13 extras PASS; large compiler example validates at 23436 bytes.
- MaiaCpp f800a2f: published MaiaC pin; npm test plus struct regressions PASS.
- MaiaJS 06905a4: published C/Cpp pins; npm run test:full PASS, All steps OK.
- MaiaGlob c9bcef0: stronger walker harness and published MaiaCpp pin. make verify
  and check-generated PASS: 10638 native/WASM matching/program cases, 10621
  frontend semantic cases, strict C89/C++98 ASan/UBSan, 18 actually executed guest
  walker cases, failing negative control, API bounds and cancellation checks.
  500 repetitions restore stack and retain 18 memory pages; workspace 94912
  bytes, ignored test WASM 1149947 bytes. Five generated artifacts reproduce
  exactly; 16 recursive dependency pins match.

The first guest walker coverage claim was incomplete: MaiaC preprocessing left
WALK_CASE invocations unexpanded after a later undef. Native scenarios did run;
matching/program parity, API checks and explicit cancellation loops were valid
but did not prove those guest traversal scenarios. Tests now call each scenario
explicitly, assert count=18, check a negative control, and report last status and
paths. No expected result was weakened. This exposed the sizeof bug: old memset
cleared only four bytes, so dot traversal failed after root traversal. The final
published compiler pins above pass reused traversal. General macro preprocessing
and MaiaCC character-class emission findings remain in MaiaGlob's owner notes.

MaiaOS local implementation uses only its published maiaglob/maiacpp submodules:
raw input -> generated shell lexer/parser -> decoded words plus protected-byte
masks -> generated MaiaGlob compiler and resumable walker -> final argv -> command
dispatch. No host matching, handwritten parser, ABI or capability additions.
VFS callbacks use existing opendir/readdir/close. I/O owns real LVGL/events;
shell stdout/stderr use bounded streams; kernel remains independently scheduled.
Both generated frontends share one normal C++98 unity translation unit, with
identifier-only prefix macros scoped between them. No generated output is edited.

Local shell files: apps/shell/shell.cpp, shell-glob.hpp, shell.wasm,
scripts/build-shell-wasm.mjs, test-shell-glob.mjs, test-shell-host.mjs, package.json,
README files, planning/SHELL_GLOB_INTEGRATION.md and gitlinks/.gitmodules. Existing
cat implementation/test/docs below remain preserved. Both features are local;
MaiaOS main/origin stays 10f1a34. No MaiaOS/cat publication, npm or version change
is authorized. Owner-library publication and tested compiler propagation are
explicitly authorized; no additional permission is needed for their validation.

Current result: published f800a2f/c9bcef0 synchronized and staged; strict C89
shell build and actual shell glob suite PASS. Functional regressions PASS:
38 unit tests, streams, shell host, 128KiB cat/1000 reads, 1024-entry directories/
1000 ls-cd cycles, 25 real LVGL boot sessions and kernel/Calculator/Clock tests.
Actual LVGL shell run: 2070 flushes, 74011 kernel steps, shell18/I/O2 pages stable.
New glob tests include single quotes, dot/parent components, absolute-to-relative
reuse, handle-limit errors and explicit parent-snapshot paths during the 512-entry
cooperative peer-close case. All handles/endpoints close.
Final grammar/parser/equivalence verification PASS: 52 raw frontend cases and
5356 JS/native C++98/WASM inputs with exact tokens/UTF-16 offsets/trees, 2400
accepted, 2136 syntax errors, 820 lexical errors, restored stack, no divergences.
Recursive remote audit passed all 34 MaiaOS pins and all owner/consumer pins
across seven GitHub repositories. See the consumer plan for commands, binary
hash and detailed evidence. No MaiaOS publication. Final import comparison: all 13 imports unchanged from
published HEAD; all 34 dependency checkouts clean. Owner MaiaC/MaiaJS retain
115/106 example artifacts were then preserved, unstaged. The owner's subsequent
artifact-publication request below supersedes that temporary dirty state.
This local slice is complete;
no active tests remain. Next safe action is owner review/optional interactive
simulator QA, then separately authorized MaiaOS publication. Keep full POSIX,
other expansion stages, pipelines and redirection explicitly out of scope.

Automatic approval review rejected broad restoration of test-produced example
artifacts because it could discard unrelated edits. It was not executed or
bypassed. At that point, MaiaC/MaiaJS examples stayed outside the compiler-fix
commits. The subsequent explicit artifact publication below commits that
preserved output instead of deleting it. A separate MaiaJS push rejection (tests thought still running) was
resolved by reading final successful log/exit status before publication.

The original glob-1.0 is preserved; no legacy GPL/public-domain matcher source was
copied into the new Apache 2.0 implementation. No agents were used. Browser
interaction has not been rerun for this integration; real LVGL WASM regression
is required separately and does not itself constitute interactive browser QA.


### Read-only cat path generalization — 2026-10-21

Owner requested continued implementation after published main/origin `10f1a34`.
Implemented the next documented bounded consumer slice: `cat <file>` now reads
VFS-authorized absolute/cwd-relative paths using the existing guest normalizer,
without public ABI/capability/status or filesystem semantics changes. No new
publication authorization was given; feature files remain local/uncommitted.
The previous directory slice is already published and must not be treated dirty.

Before editing, wrote `docs/planning/SHELL_CAT_READ_ONLY.md` with exact behavior
and acceptance. Cat accepts one path (including quoted Unicode/space paths),
rejects stdin/options/multiple operands with usage, uses existing VFS READ only,
reports permission/quota/path errors and preserves generic open/read failures.
It copies file bytes unchanged, without adding newline, through the existing
bounded 128-byte reader/pending-output state machine. Existing path/input/word
limits apply; failed cat does not change cwd. VFS remains authorization authority.
No directory probe/stat API, host terminal/parser or JavaScript command logic
was added. I/O remains C++98 maia.gfx -> actual LVGL. Kernel keeps stepping.

Changed: shell.cpp and reproducible shell.wasm; package test script; new
`scripts/test-shell-files.mjs`; expanded actual LVGL host and boot tests; README,
shell README, ABI consumer documentation, new slice contract and this handoff.
No VFS/host adapter, manifest, compiler, grammar, generated source, dependency pin,
version or npm change. Exact old/new WASM imports were compared and are equal;
EBNF/generated parser/Regex headers + shell manifest are byte-identical to HEAD.
All seven principal dependency repositories remain clean. MaiaOS HEAD `10f1a34`.

Verification PASS:
- `npm run build:shell -- --check-c89`: 1193374-byte WASM built by pinned MaiaCpp
  AST-strict -> C89 -> MaiaC/MaiaWASM; Clang checks syntax only.
- `npm test`: 38 tests. `npm run test:shell-files`: exact 128KiB binary stdout
  through 31-byte output ring, 1000 reads, quoted Unicode paths, private-home
  isolation, empty/unterminated content, usage/errors/quotas, exact path bounds,
  paused and closed peers, partial-output read error, final unterminated cat on
  stdin EOF, stable guest stack/memory and complete file/stream cleanup.
- `npm run test:shell-lvgl`: actual kernel/I/O/shell, prior command/directory/
  editing/error/bounds regressions plus cat absolute/relative/quoted paths,
  permissions, empty/unterminated content and large UTF-8 output. Shell 18 pages,
  I/O 2 pages, 73612 kernel steps, 1000 repeat parses, all handles/streams closed.
- `npm run test:shell-boot`: 25 launch/exits, failed startup, quotas, unchanged
  URL, directory and file import traps with live handles; production cleanup
  releases all handles/windows/endpoints. Actual WASM/LVGL Node reference harness.
- `npm run test:shell-directories`, `npm run test:io-streams`,
  `npm run test:lvgl-host`: previous directory/stream/kernel/Calculator/Clock PASS.
- JS syntax and `git diff --check` PASS. Full 5356-case parity corpus not rerun:
  lexer/parser/grammar are unchanged; previous published baseline remains valid.
Logs: `/tmp/maia-cat-build.log`, `/tmp/maia-cat-test*.log`, `/tmp/maia-cat-files.log`,
`/tmp/maia-cat-host.log`. Live browser interaction, device callbacks and MaiaWASMVM
checks remain UNRUN; do not claim those from Node/LVGL reference tests.

Known limits: one operand, no stdin/options/multi-file cat or write/redirection;
generic file-open API cannot distinguish missing files from directory targets.
Raw streams preserve binary bytes, while I/O intentionally interprets/sanitizes
UTF-8/terminal controls according to its existing profile (not a binary viewer).
No new GUI or shell parsing rules were implemented. No commit/push/npm performed.
Next: owner can refresh simulator, run `cd /system`, `cat welcome.txt`, `pwd`,
then review local feature publication. Later writable files/redirection or new
process/VM APIs require their own concrete behavior/contracts before extension.
Historical sections below describe older published states, superseded here.


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
