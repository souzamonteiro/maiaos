> Extension approved 2026-10-22: final-stage stdout `>`/`>>` composition, plan v2
> and owner-only cancellation are specified in
> [SHELL_PIPELINE_OUTPUT_REDIRECTION.md](SHELL_PIPELINE_OUTPUT_REDIRECTION.md).
> The original v1 scope/exclusions below describe the initial published slice.

# Pipeline process contract — proposal for review

2026-10-22. Fourth slice in the owner's requested order. This document is a
approved for implementation by the owner on 2026-10-22. It is not yet a
completed or device-validated ABI. The owner subsequently authorized commit/push
of this tested slice and its generated artifacts on 2026-10-22.
The preceding stdout redirection slice is published as MaiaOS 4783c5d.

## Missing foundation and ownership

The current kernel.cpp guest exercises graphics/events/VFS. It does not yet own
an implemented process table or spawn/wait policy. The browser currently assigns
PIDs, starts isolated WASM instances and iterates its runningProcesses set.
MaiaStreamBroker has bounded read/write/close, but connect/alias are host-only and
alias currently operates within one process. There is no guest spawn/wait/pipe
API. Implementing a JavaScript command pipeline here would bypass the architecture.

Add the smallest kernel-owned lifecycle slice. Kernel C++98 owns PIDs, process
and group states, permission decisions, reservations, graph edges, runnable order,
exit aggregation and reaping. The platform host compiles/instantiates approved
WASM packages, copies validated packets, binds broker endpoints and reports
outcomes. It executes kernel actions and does not select commands or lifecycle
policy. Existing kernel GUI/event behavior stays functional; io.wasm retains
keyboard/terminal/LVGL ownership. No DOM terminal or in-host cat implementation.

## Initial execution scope

Start with two to four actual isolated cat workers, e.g.
`cat /shared/a /shared/b | cat` and `cat /shared/a | cat | cat`.
A new C++98 cat worker package accepts already expanded argv and implements byte
copying with fixed buffers, VFS imports and bounded streams. It is compiled using
published in-repository MaiaCpp/MaiaC. The interactive shell keeps its existing
builtins; the pipeline resolves cat to the whitelisted worker package. No source
string is re-parsed by host or child, so filename metacharacters remain data.
The first stage must have file operands; later operand-free cat reads stdin until
EOF. Cat with file operands reads those files; no options are added.

Parent shell walks the existing generated Pipeline/SimpleCommand tree, validates
all stages and runs quote-preserving MaiaGlob expansion before submitting a plan.
Keep current input/token/tree/word limits, with at most 12 expanded words total
across the group and 95 UTF-8 bytes per word. Reject unsupported stages, compound
execution, AND/OR/background, negation, any pipeline redirection or malformed
plans before reserving resources or launching any worker. Pipeline redirection
composition is a later explicit extension; simple-command > and >> stay supported.
This is a documented vertical slice, not a general POSIX exec/job implementation.

## Proposed additive guest ABI

New `process.pipeline` capability gates both imports below. Existing process.exit
and stream read/write/close signatures and status codes remain unchanged.

- `maia.process.pipeline_start(plan_ptr:i32, plan_len:i32) -> i32`: positive
  kernel-owned group handle on accepted asynchronous launch; otherwise -1 invalid
  packet/unsupported form, -3 unauthorized identity/capabilities, or -4 quotas.
- `maia.process.pipeline_wait(group:i32, out_ptr:i32, capacity:i32) -> i32`:
  -6 while launching/running/rolling back; -7 invalid/reaped handle; -3 foreign
  group; -1 invalid memory/capacity; -4 insufficient capacity. A completed group
  copies the status packet, returns its byte length and reaps once. A rejected
  output buffer does not consume completion. The parent yields instead of polling
  inside one unbounded guest call.

Plan wire format, little-endian u32: 16-byte header (version=1, stages, words,
stringBytes), stages*8 bytes (firstWord, wordCount), words*8 bytes
(stringOffset, byteLength), then contiguous UTF-8 strings. Absolute offsets point
into this packet. Require 2..4 stages, 1..12 words total, contiguous non-overlapping
stage/word ranges and tightly packed valid UTF-8 without NUL, word length <=95,
exact total length <=1536. Stage first word must equal cat. Validate the complete
copied packet before side effects; no guest pointer survives the import.

Completion packet: 16-byte header (version=1, group, stages, finalStatus), followed
by stages*8 bytes (pid, exitStatus). Size 32..48 bytes. finalStatus is the last
stage status for normal completion; launch/trap rollback returns failure status 1.
A worker trap is reported to the kernel and cancels the remaining group. No
pipefail, signals or job control are claimed.

Workers get a separate `process.args` capability and proposed imports
`maia.process.args_size() -> i32` and
`maia.process.args_copy(out_ptr:i32, capacity:i32) -> i32`.
They expose only that worker's immutable argv packet: version=1, argc, followed by
argc offset/length pairs and tightly packed strings, with the same bounds. A copy
failure leaves memory unchanged. These are binary transport, not shell parsing.

## Kernel/reference-host boundary

Add trusted-host kernel exports, separately documented as reference boot/service
control rather than application syscalls:
- `maia_kernel_buffer_ptr/maia_kernel_buffer_capacity` expose one bounded 4096-byte
  request/action scratch buffer in kernel memory. Host copies synchronously.
- `maia_kernel_boot_reserve(role, requestBytes) -> pid` validates a manifest summary
  in scratch and allocates boot IDs. Kernel PID is 1; host nextProcessId policy is
  replaced by this allocator. Roles are fixed kernel/I/O/interactive app.
- `maia_kernel_pipeline_start(callerPid, requestBytes) -> group` validates the
  copied plan with caller identity supplied by the trusted host closure.
- `maia_kernel_next_action() -> bytes` serializes one versioned action into scratch:
  reserve/bind stream edge, start worker, stop worker, release binding. Each action
  has a monotonic action ID and group/PID ownership. No host invents a graph edge.
- `maia_kernel_boot_ready(pid, status)` marks a successful boot instance runnable,
  or releases a failed boot reservation.
- `maia_kernel_action_result(actionId, status)` commits that action's result;
  `maia_kernel_process_exit(pid, status, trapped)` reports worker exit/trap.
- `maia_kernel_next_runnable() -> pid` selects the next runnable non-kernel guest;
  `maia_kernel_pipeline_wait(callerPid, group, capacity) -> bytes/status` writes
  completion in scratch after bounds/ownership checks. Host copies to caller only
  after validating the caller's complete output range.

All named exports use i32 parameters/results; the buffer accessors have no
parameters. Control operations return 0 on accepted notification, -1 on invalid
arguments/state, -3 on ownership/policy failure or -7 on stale identity/action.
`next_action` returns 0 when idle, otherwise the exact action packet length; until
acknowledged it returns the same pending action ID without advancing. IDs and
PIDs are monotonically increasing, never reused during boot, and exhaustion
returns -4. The host tracks an in-flight action ID to avoid duplicate asynchronous
instantiation, without selecting its outcome. `next_runnable` returns 0 if idle.

Boot summary: eight little-endian u32 fields (version=1, role, memoryPages,
openFiles, resourceMask, ioPid, appIdBytes, reserved=0), then the ASCII app ID.
Exact length is 32+appIdBytes <=160; IDs follow the existing app-ID validation.
Role 0 is org.maiaos.kernel (PID 1 only), role 1 is org.maiaplatform.io, role 2 is a
catalog application. Host must already have validated the actual package imports,
manifest and grants. Resource-mask bits are: 0 vfs.open, 1 vfs.read, 2 vfs.write,
3 vfs.close, 4 vfs.opendir, 5 vfs.readdir, 6 process.pipeline, 7 stream.read,
8 stream.write, 9 stream.close, 10 process.exit, 11 gfx, 12 events. Unknown bits
are invalid. Memory is 1..32 pages, openFiles 0..16; the kernel only grants
process.pipeline to the interactive shell package. ioPid is 0 except an
interactive shell, where it identifies a reserved, unpaired I/O instance. Kernel
owns pairing, stream-bind actions and runnable transitions after boot readiness.
Memory allocation bridges are transport/runtime support, not additional file
or process authority. Guest application pointers never identify another guest.

Action packet: eight little-endian u32 fields (version=1, kind, actionId, group,
pid, arg0, arg1, payloadBytes), followed by tightly packed payload; total <=4096.
Reserved arguments below must be 0. Only the kernel constructs these packets:
- kind 1 PIPE: pid=reader PID, arg0=reader fd, arg1=writer PID; payload is two u32
  fields (writer fd, capacity 1..4096). Both children belong to the same group.
- kind 2 DELEGATE: pid=target child, arg0=target fd, arg1=parent PID; payload is
  source fd (u32). Only parent stdout/stderr -> child stdout/stderr is permitted.
  Broker adds a privileged cross-process reference binding, not a guest dup API.
- kind 3 START: pid=child, arg0=worker package index (1 = the catalog cat package),
  arg1=reserved memory pages; payload is the immutable worker argv packet. Host
  validates that package's real imports/manifest and initial memory against the
  reserved profile. It instantiates but invokes worker entry only on the first
  kernel-selected runnable turn, after all group starts have acknowledged success.
- kind 4 STOP: pid=child, arg0=exit status, arg1=reason (1 parent cancellation,
  2 worker trap, 3 launch failure), no payload. Host teardown releases that
  instance's files/streams and acknowledges; policy/state remain in kernel.
- kind 5 RELEASE: pid=endpoint owner, arg0=fd, arg1=0, no payload; releases an
  endpoint reserved before an instance exists. Never releases parent terminal fds.
- kind 6 EOF_INPUT: pid=first child, arg0=0, arg1=capacity 1..4096, no payload;
  creates an owned reader whose writer is already closed, through a new privileged
  broker transport operation. No synthetic runnable producer or guest pipe API.

An action result of 0 means transport completion; a negative result triggers
kernel rollback. A failed partial instantiation must be torn down before failure
acknowledgment. Kernel states are RESERVED -> STARTING -> RUNNING -> EXITED ->
REAPED; failures use ROLLING_BACK before group completion. A group is never
runnable until all starts succeed. Group acceptance blocks only its parent until
completion; completion makes that parent runnable to consume wait. The reference
host advances kernel GUI/events once per frame and dispatches at most 16 selected
guest steps, following kernel round-robin selection. Known worker steps have
bounded copy/iteration budgets; no native-reference instruction-fuel claim.

## Isolation, quotas and cleanup requirements

Limit to 16 live process slots including boot guests, four groups and four stages
per group; reserve all slots, buffers, worker memory and graph endpoints before
first launch. Child memory <=32 pages each; total worker reservation <=128 pages.
Children each have separate WASM memory, VFS handle table and <=4 open files.
The child package identity differs from the delegated effective VFS app identity:
its VFS is explicitly confined to the caller's authorized home plus existing
shared/read-only mounts. No foreign home or ambient caller handles are exposed.
Child resource grants are the intersection of package requests, caller grants
and host policy; process.args is a kernel-provided bootstrap-only data capability.
No process.pipeline capability is granted to workers. Delegation needs explicit
owner approval because existing boot apps use their own manifest home identity;
that delegation was included in the owner approval on 2026-10-22.

Each edge is a <=4096-byte pipe. Kernel actions permit cross-process endpoint
bindings; broker transport adds checked privileged delegation without a guest
alias API. First stdin has an EOF writer; last stdout and all stderr use retained
terminal endpoints. Parent remains the interactive input owner and does not run
the next command until completion. EOF requires the last writer reference to
close; reader close produces CLOSED for writers. No parent endpoint may retain
an unintended pipe writer. Parent prompt follows all child exit and terminal
drain through I/O. Startup failure rolls back spawned instances and every endpoint,
VFS handle, slot and memory reservation before completion is observable. Parent
exit/trap/window close cancels descendants through kernel policy, then host
teardown executes the resulting actions. No failed group survives for later input.

## Required evidence before declaring success

Actual C++98 kernel + shell + cat worker WASM, actual io.wasm/LVGL, generated shell
parser and guest MaiaGlob; at least two separate worker memories/PIDs. Assert
exact binary order/output for empty/large files, quoted glob operands and literal
metacharacters, private-home delegation and foreign denial. Force <=31-byte pipes,
slow terminal, partial writes, downstream early close, failed second-stage launch,
worker trap, invalid packets, quotas, foreign waits and short completion buffers.
Repeat groups until stable memory/stack/endpoint/process counts are demonstrated.
Keep kernel/Calculator/Clock and all existing shell redirection/boot suites green.
Reference native-WASM tests do not claim MaiaWASMVM fuel, device timing or microSD
behavior. No version/npm/commit/push authorization is inferred from plan review.


## Implementation notes

Kernel policy is apps/kernel/processes.hpp, included by kernel.cpp. Runtime
maia-kernel-processes.js only copies packets and forwards exported decisions;
maia-pipeline-transport.js executes kernel actions. The reference browser allocates
boot PIDs through the kernel, honors its runnable order and defers worker entry
until all group starts are acknowledged. Boot group 0 also binds existing I/O
fds 3/4/5; its DELEGATE actions preserve the established same-process stdout/stderr
and I/O-reader aliases. Pipeline groups delegate only their caller's terminal fds.
A kernel halt tears down its platform instances; no app continues under a dead
kernel. Pending starts are bound to their boot identity and never enter a new
kernel after reset.

The worker is apps/cat/cat.cpp (4240-byte WASM), with a separate manifest and no
GUI imports, JavaScript builtin implementation or shell re-parse. The shell
normalizes file operands against its own cwd before encoding the plan. These
canonical operands must fit the already approved 95-byte word wire bound; a
longer canonical path is rejected before launch. No directory options or arbitrary
executable loader is added. Existing builtins and simple-command redirects remain
available. Process args is immutable copied bootstrap data, not a cross-guest
pointer. Kernel POD lowering declares the existing env allocation bridges; the
kernel manifest now requests their existing memory.alloc/memory.free capabilities.
There is no new runtime allocation syscall.

Builtin-only legacy regression fixtures install fail-fast guards for their unused
pipeline imports. They are not used as pipeline evidence. Actual pipeline suites
instantiate the real kernel and independent workers, and a separate suite invokes
the production browser boot/scheduler functions plus actual I/O/LVGL and shell.

Reproduce: build:kernel -- --check-c89, build:cat -- --check-c89,
build:shell -- --check-c89; test:kernel-processes-native (ASan/UBSan),
test:kernel-processes, test:pipeline-workers and test:shell-pipelines. Existing
unit, files/glob/directories/redirection/boot/I/O/LVGL and parser parity suites
remain required. Generated kernel.wasm/kernel.js are currently ignored build
outputs; publication, when separately approved, must explicitly include those
reviewable runtime artifacts alongside cat.wasm/shell.wasm and generation sources.
The owner subsequently authorized Git publication of this tested slice and its
generated artifacts; no version/npm release is authorized.


## Final local evidence (2026-10-22)

Strict kernel/worker/shell C89 builds passed. Artifacts are kernel 38644 bytes / 2
initial pages, cat 4240 bytes / 2 pages, shell 1266970 bytes / 18 pages. npm test
passed all 50 cases. Native C++98 ASan/UBSan passed 4096 malformed inputs and 100
group lifecycles. Actual kernel/worker tests passed separate memories, 256KiB
binary transfer over 31-byte pipes, early downstream close, failure rollback and
stable repetitions. Production boot/scheduler plus shell/I/O/LVGL passed the same
31-byte profile, private delegation, quote/glob paths, four stages, 25 repetitions,
profile denial/recovery, pending-start shutdown and complete resource cleanup
(33 real flushes in the last run). All 5356 frontend parity inputs still match.
Existing files/glob/directories/redirection/boot/I/O/kernel/Calculator/Clock
regressions passed. No interactive browser/device/VM-fuel claim. The kernel policy
rejected malformed requests before reservation and handled completion orphaning
and stale action acknowledgments without consuming new process slots.

The owner explicitly approved publication of this tested snapshot, including this
contract and reproducible generated runtime artifacts. Redirection is already published as
4783c5d. No versions/npm releases were performed.
