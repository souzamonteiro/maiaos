# Pipeline stdout redirection — approved implementation contract

Date: 2026-10-22. Status: owner approved the exact contract and implementation on 2026-10-22;
implemented and validated locally through native C++98 and actual WASM/LVGL tests.
Browser-interactive validation remains pending; no publication authorized.
Baseline: published MaiaOS `09b566b`.

## Goal and ownership

Support `cat input | cat > output` and `cat input | cat >> output` with
two to four existing cat workers. Exactly one stdout redirection must belong
to the last SimpleCommand in the generated MaiaCC tree. Preserve quoting,
MaiaGlob target expansion and all existing pipeline/command limits. Redirection
on earlier stages, descriptor redirection, input redirection, multiple
redirections and other commands remain rejected before opening files or starting
workers. No new grammar or handwritten parsing is needed.

The shell opens and writes the target through existing VFS imports. The kernel
routes the last worker's stdout to a bounded pipe read by the shell. Workers
retain their published read-only VFS profile, separate memories and handles.
The host applies kernel stream actions and copies packets; it never interprets
paths, redirection syntax or command execution policy. I/O retains real LVGL
terminal/event ownership. Browser execution still uses native WebAssembly;
this feature makes no MaiaWASMVM or physical-device validation claim.

## Approved public additions

1. Accept pipeline plan version 2 in the existing pipeline_start import.
2. Add `maia.process.pipeline_cancel(i32 group)->i32`, gated by the existing
   process.pipeline capability and the owning process identity.
3. Add trusted kernel export
   `maia_kernel_pipeline_cancel(i32 caller_pid,i32 group)->i32` and corresponding
   controller/transport forwarding. Guest callers never supply caller_pid.

Version 1 plans, worker argv version 1, completion packet version 1, all existing
import signatures, capability names, VFS flags and error values stay compatible.
There are no new repositories, dependencies, compiler changes or package releases.

## Version 2 plan

All fields are unsigned little-endian 32-bit integers:

| Offset | Field | Constraint |
| --- | --- | --- |
| 0 | version | 2 |
| 4 | stageCount | 2..4 |
| 8 | wordCount | <=12; argv only, excludes the target |
| 12 | stringBytes | Exact number of packed argv string bytes |
| 16 | outputMode | 1: last stdout returns to the owner |
| 20 | reserved | 0 |
| 24 | stages | stageCount pairs (firstWord, wordCount) |
| following stages | words | wordCount pairs (absolute offset, UTF-8 byte length) |
| following words | strings | Contiguous argv bytes, no terminators or gaps |

Total plan <=1536 bytes. Existing stage/argv/name/UTF-8/canonical input path checks
apply, with the table base changed from 16 to 24 for version 2. Unknown versions,
modes, reserved bits, trailing data, overlapping tables or invalid counts fail
with -1 before reservation or endpoint mutation. Ordinary pipelines keep using
version 1. The shell's existing expansion budget is still 12 words INCLUDING
the redirection target, so this feature does not expand the interactive limit.

The shell first verifies that stream handle 3 is unbound using the existing
zero-length read; an occupied endpoint is rejected before target open. The kernel
also protects against binding collisions and only releases successfully acquired
endpoints.

The target path and append/truncate flags do not enter this packet or worker
argv. The target belongs to shell VFS state, not to cat. Kernel authorization
additionally requires the owner's existing vfs.write grant for outputMode 1;
missing grants fail with -3. Only the existing authorized shell identity may
submit a pipeline. One unreaped group per owner is permitted, including while
that owner is runnable; a second start returns -4 with no side effects.

## Stream ownership and scheduling

The kernel reserves owner stream handle 3 for the active version 2 group. This
is a stream handle in the owner's private table, independent of its VFS handle
numbers. Handles 0/1/2 retain terminal stdin/stdout/stderr. No arbitrary target
descriptor or descriptor transfer API is exposed.

Use the existing PIPE action kind 1 for the last stdout: reader (owner,3), writer
(last child,1), capacity <=4096. Other stage bindings, stderr delegation, immutable
argv and deferred startup are unchanged. A host binding collision fails the
action and rolls the group back; never replace an existing endpoint. The kernel
retains the logical handle reservation until cleanup and reaping complete.

Keep the owner blocked during startup. After every binding/start action succeeds,
make both the owner and workers runnable. The owner consumes handle 3 and writes
the copied bytes through VFS, using bounded buffers and the existing cooperative
step budget. It must retain partial writes, yield on -6 and stop reading when its
output buffer is full. This avoids a wait-before-drain deadlock. Version 1 owners
retain their existing blocked-until-completion scheduling.

At normal EOF, drain the shell's queued bytes, close its local stream endpoint,
then wait/reap the group and close the output file before printing a terminal
prompt. EOF alone is not group completion. In version 2, a successful wait also
requires acknowledgement of an idempotent kernel RELEASE action for (owner,3).
On first wait against a completed group, request that action and return -6 until
acknowledged; subsequent wait returns the unchanged completion packet and reaps.
Calling wait before consuming EOF may discard that caller's remaining output;
the shell must never do so during normal completion. A too-small completion
buffer must not initiate cleanup or reap, preserving the existing wait contract.

## Failure, cancellation and file effects

Validate the generated tree, stage commands, expanded argv, canonical input
paths, target cardinality and plan bounds before target open. Open the target
with existing flags 14 (WRITE|CREATE|TRUNCATE) or 22 (WRITE|CREATE|APPEND), then
submit the plan. A denied/invalid target launches no children. A successful open
can create/truncate even if subsequent reservation/start fails, matching existing
simple-command redirection semantics; this is not a transactional file operation.
Redirecting an input onto itself truncates before workers open inputs. APPEND
uses the shared store's current end on each write. Existing namespace, file/store
quotas and asynchronous persistence semantics apply without new durability claims.

pipeline_cancel returns 0 when cancellation has been accepted for an owned live
group, or when that group is already rolling back/complete. It returns -7 for an
unknown/reaped group and -3 for a different owner. It uses the existing rollback
policy, marks cancellation as failed (aggregate status 1), and does not reap.
A completed group with output still pending can also be cancelled, discarding
remaining output and producing aggregate status 1. Cancellation is not atomic
rollback of already accepted file bytes.

On VFS read/write/close or stream transport failure, report an error to terminal
stderr, stop accepting pipeline stdout, close target/owner endpoint, request
cancellation, and keep the shell alive to wait until kernel cleanup is acknowledged.
Never print a prompt or admit a new command before group cleanup. Retain the
accepted file prefix; discard only unaccepted stdout. A late target-close error
after reaping is a local command error with a terminal diagnostic; no cancellation
is possible or needed once the group has been reaped. Ordinary nonzero cat exit
still drains stdout before reporting pipeline failure.

Kernel rollback for failed startup, trap, cancellation or owner exit releases
both child endpoints and the owner output endpoint before completing/reaping the
group. Idempotent RELEASE may find an endpoint already closed by the guest.
In-flight asynchronous START acknowledgements still belong to the original
group and are stopped/released before reuse. Host transport must retain the owner
context through cleanup acknowledgements. A rollback may discard buffered output;
only bytes already accepted by VFS are guaranteed to remain. A missing handle 3
after rollback is resolved through wait/cleanup, not treated as successful EOF.

## Implementation scope and acceptance

Expected source changes: kernel processes.hpp; shell.cpp/shell-pipeline.hpp/
shell-glob.hpp; kernel controller, pipeline transport, import/capability mappings;
production boot forwarding as needed; ABI/planning/handoff/user documentation;
tests and reproduced kernel/shell artifacts. Cat code, package profile, I/O GUI,
compiler repositories and generated shell grammar remain unchanged.

Required checks before declaring implementation complete:

- Native C++98 kernel tests with ASan/UBSan and actual kernel WASM tests: version
  compatibility, malformed v2 packets, permissions, owner-only cancellation,
  busy-owner rejection, deferred startup, round-robin owner drain, failed action,
  in-flight cancel, trap, exit, idempotent cleanup and full quota reuse.
- Actual shell/kernel/cat/I/O/LVGL integration using production boot/scheduler
  functions: truncate, append, empty/binary/large output through 31-byte pipes,
  two/four stages, relative/private/quoted/glob targets, unambiguous expansion,
  stderr staying on terminal, repeated runs and prompt only after file closure.
- Negative forms create no file or children; protected/foreign paths denied;
  missing source, output quota/write/close failure, failed launch and parent exit
  preserve specified file effects and release all resources without deadlocks.
- Strict C89 checking via MaiaCpp -> MaiaC builds of changed guests; npm test;
  existing pipeline/worker/redirect/boot regressions and generated frontend
  equivalence where AST extraction changes. Do not weaken existing assertions.
- Browser interactive validation when the in-app browser becomes available.
  Node execution of production boot functions is integration evidence, not
  browser UI interaction. Physical-device and MaiaWASMVM execution remain pending.

The owner explicitly authorized implementation of this contract, excluding
commit/push, npm and version changes. Publication requires separate authorization.
