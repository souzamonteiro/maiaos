# Next vertical slice: shell through a real I/O guest

Status: owner approved; implemented and reference integration tested. 2026-10-20.
Browser interaction and device/MaiaWASMVM verification remain unrun.

## Goal

Use the shell to exercise the actual MaiaOS service contracts and the complete
MaiaCpp -> C89 -> MaiaC/MaiaWASM chain. The next milestone is a booted
kernel.wasm + io.wasm + shell.wasm session, with all three guests scheduled and
isolated. Existing simple-command behavior and the generated lexer/parser remain.
The 1.6.0 release metadata must first be reproducible through recorded gitlinks.

## Responsibility split

- Platform boot coordinator starts the guests and supplies declared capabilities,
  per-instance memory and bounded byte-stream bindings. It does not parse commands,
  edit terminal text or execute shell builtins.
- kernel.wasm continues running during I/O and shell interaction. This milestone
  does not claim that its current sample guest is a complete privileged kernel,
  process manager, filesystem server or MaiaWASMVM implementation.
- io.wasm owns terminal rendering through existing maia.gfx, keyboard events,
  line editing/history/caret and canonical line delivery. Its implementation is
  real C++98 compiled by MaiaCpp/MaiaC, not a host JavaScript terminal.
- shell.wasm owns prompt generation, generated lexing/parsing, command validation
  and builtin/VFS execution. It reads stdin and writes stdout/stderr through the
  proposed stream ABI; it no longer imports graphics or keyboard events directly.
- Host adapters implement only checked copies, bounded stream buffers, endpoint
  ownership/lifecycle and scheduling. The native-device binding can implement
  the same contract; browser-native WASM remains a reference execution backend.

The browser boot coordinator remains the current platform host. This proposal
implements the documented I/O guest boundary, not a replacement architecture.

## Approved additive ABI

Keep existing APIs/signatures intact. Add versioned capabilities and the following
numeric imports (all buffers refer to the calling guest's memory):

| Import | Signature | Result |
|---|---|---|
| maia.stream.read | (handle:i32, out_ptr:i32, capacity:i32) -> i32 | Bytes read; 0 is EOF after writer closure and draining |
| maia.stream.write | (handle:i32, ptr:i32, length:i32) -> i32 | Bytes copied; partial writes are permitted |
| maia.stream.close | (handle:i32) -> i32 | Close the caller's endpoint |

Capabilities: stream.read, stream.write, stream.close. Unknown, unrequested or
ungranted imports remain rejected. Handles are local to each process; the broker
never exposes another guest's pointers or unrestricted shared memory.

Streams use a 4096-byte bounded ring and a maximum 4096-byte copy per call in this
first profile. A valid zero-length operation returns 0 without changing state.
An empty live read or full write returns existing WOULD_BLOCK (-6); callers yield
and retry during later maiaos_step calls. Never spin until data becomes available.
Out-of-bounds pointers/invalid sizes return INVALID_ARGUMENT (-1) without partial
memory mutation. Unknown/closed local handles return INVALID_HANDLE (-7), and an
operation on the wrong endpoint direction returns PERMISSION_DENIED (-3).
Additive status CLOSED (-8) applies to writes after the reader has closed.
Buffered bytes remain readable after writer close, followed by EOF. Process exit
closes owned endpoints and propagates those lifecycle effects to peers.

The boot host binds shell stdin/stdout/stderr as local handles 0/1/2. The I/O
service receives corresponding write/read/read endpoints as 3/4/5 in this initial
fixed boot profile. These are logical handles, not fixed linear-memory addresses.
The terminal binds stdout/stderr to one ordered output pipe (1/2 aliases; 4/5
read aliases) so errors cannot move after subsequent prompts.
Endpoint creation/binding is privileged boot-host setup, not an unrestricted
new guest API. This fixed profile does not claim general process spawning,
handle transfer, arbitrary pipelines or a complete POSIX file descriptor ABI.

No new readiness event type is required initially: the existing bounded step
scheduler polls streams without blocking. A future notification extension must
be specified and tested separately. Prompt bytes come from the shell; io.wasm
keeps the caret beside the unfinished prompt/output line and edits input there.

## Approved implementation order and acceptance (original plan)

1. Confirm the release baseline: currently the principal MaiaC has staged package
   and gitlink updates; several consumers have dirty dependency pointers. Preserve
   these until the owner finishes/authorizes their Git publication/synchronization.
2. Review/approve this ABI and responsibility split before adding public imports,
   capabilities, status code or a new guest-service execution path.
3. Implement the bounded stream broker and per-guest bindings with tests for
   partial transfer, backpressure, ownership, bounds, EOF, closed peer, repeated
   close and process-exit cleanup. Include queue reuse and memory canaries.
4. Build io.wasm from C++98 using repository-local pinned compilers. Move terminal
   behavior out of the shell without adding parsing or command logic to I/O.
5. Wire the actual boot sequence and adapt shell stdin/stdout/stderr. Verify all
   six existing commands, quote/error cases, inline prompt/caret, editing/history,
   VFS reads, exit/relaunch and 1000 commands while the kernel keeps stepping.
6. Run JS/native/guest differential lexer/parser tests and real LVGL integration;
   then browser keyboard/touch/fullscreen checks. Distinguish reference-engine
   evidence from device/MaiaWASMVM evidence. Compare allocations and latency.

The following slice can add VFS directory enumeration and shell-local cwd for
ls/cd, then broader cat/write/redirection behavior. Specify their contracts first:
these services are not yet supplied by the existing open/read/write/close ABI.
Pipelines must use the same bounded stream mechanism with backpressure.

## Separate performance work

The dense MaiaRegex memo clearing bottleneck is measured but not fixed. Keep it
as a separately reviewed owner-repository change, with ordered matching/cycle/
assertion semantics and the 5356-case parity corpus preserved. Do not mix a Regex
algorithm rewrite into the simulator presentation or I/O-boundary milestone.

## Implementation evidence

Published release-baseline commits: MaiaC 32ebd46, MaiaCpp 09db55c,
MaiaJS d5440b4, MaiaOS 37e14b0; no extra npm release or version change.
UI/I/O code is outside those synchronization commits; its separate MaiaOS
publication was explicitly authorized by the owner on 2026-10-20.

Both guest builds pass `--check-c89` using pinned Maia Suite compilers. Actual
WASM tests cover fragmented output UTF-8/clear sequences, partial writes,
backpressure, closed peers, large VFS reads through a 31-byte ring, EOF and input
recovery. The full kernel/I/O/shell LVGL session preserves all command/edit/error
checks and 1000 repeated parses: shell 18 pages, I/O 2 pages, stable stacks, kernel
continues stepping. Actual boot functions also pass failed-start cleanup and 25
LVGL launch/exit cycles without surviving windows/endpoints. The approved ABI
and exact limits are recorded in ../specifications/abi-v0.md.

Interactive browser checks are still required; browser discovery returned no
available integrated backend. Device firmware, MaiaWASMVM/fuel, general process
spawning, directory operations and POSIX shell conformance remain future work.
