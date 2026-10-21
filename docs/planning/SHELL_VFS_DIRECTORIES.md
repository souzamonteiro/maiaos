# Shell directory navigation and bounded VFS enumeration

Status: explicitly approved by owner; implemented and reference tested. 2026-10-20.
Interactive browser/device checks remain separate and unrun.
Baseline: MaiaOS main `160befe`, published; compiler packages remain 1.6.0.

## Consumer and scope

Implement `ls [path]`, `cd [path]` and a real shell-local `pwd`, using the existing
generated C++98 lexer/parser, streams and I/O/LVGL service. Keep the initial cwd
`/` for compatibility. `cd` without an operand selects
`/home/org.maiaplatform.shell`; `cd path` updates cwd only after successful VFS
directory validation. Each shell instance starts fresh and owns its own cwd.

Paths are resolved lexically in the C++98 shell: absolute paths start at `/`,
relative paths at cwd, repeated slashes and `.` disappear, and `..` at root stays
at root. The normalized absolute UTF-8 path is at most 1023 bytes excluding NUL.
Over-limit paths fail without truncation or state change. This is a logical
path profile without symlinks, physical-path resolution, HOME/OLDPWD/environment
expansion, `cd -`, shell options or POSIX-conformance claims. Host import paths
remain absolute, with the existing strict normalization and ownership checks.
The shell never changes the browser URL or host process directory.

`ls` defaults to cwd and accepts one path operand. It lists immediate children,
including dot-prefixed names, in UTF-8 byte order, one entry per line, with `/`
after directory names; it omits synthetic `.` and `..`. No flags, recursion,
wildcards, metadata columns or multiple operands are introduced. Escape backslash
as `\\` and ASCII control bytes/DEL as `\xHH` before terminal output, preventing
names containing newline/ESC from being interpreted as terminal commands. Preserve
other UTF-8 bytes; a directory entry is data, never shell source to parse/execute.

`cat` remains limited to its existing `/system/welcome.txt` operand in this slice;
general relative cat, filesystem mutation, redirection and pipelines are separate
work. Extend `help` to describe the eight implemented commands.

## Approved additive ABI

Two new numeric imports and capabilities; existing signatures remain intact:

| Import | WASM signature | Capability | Result |
|---|---|---|---|
| maia.vfs.opendir | (path_ptr:i32, length:i32) -> i32 | vfs.opendir | Positive directory handle, or negative error |
| maia.vfs.readdir | (handle:i32, out_ptr:i32, capacity:i32) -> i32 | vfs.readdir | One complete entry packet;0 at end; negative error |

Reuse `maia.vfs.close(handle)` and capability `vfs.close` for directory handles.
Directory and file handles share a per-adapter numeric namespace and the existing
open-handle quota. They remain distinct from stream handles. Calling file
read/write on a directory handle, or readdir on a file handle, returns -1.
Unknown/closed handles return -7. Repeated close returns -7.

One new status: `NOT_DIRECTORY=-9`, returned by opendir when the normalized target
is a file or a path component required as a directory is a file. Preserve existing
codes: -1 invalid arguments/encoding/path, -2 nonexistent directory, -3 denied
namespace, -4 quota/snapshot/buffer exhaustion. Check home ownership before
existence to avoid exposing another application's private paths.

Validate a 1..1023-byte path range and strict UTF-8 before opening. Readdir capacity
must be 16..4096 bytes; validate the entire requested guest range before accessing
or advancing the directory cursor. Failure must not change output memory, cursor
or handle allocation. A valid buffer smaller than the next whole packet returns
-4 and leaves the next entry pending. Never split one entry across calls.

Directory-entry packet version 1, little-endian, with no pointers or implicit
C struct packing:

| Offset | Field | Meaning |
|---|---|---|
|0 | u32 version |1 |
|4 | u32 type |1 regular file;2 directory |
|8 | u32 name_length |1..255 UTF-8 bytes |
|12 | u32 reserved |0 |
|16 | name bytes | Exactly name_length bytes, no slash or NUL, no terminator |

The return count is `16 + name_length`. Example: `/system` contains `welcome.txt`:
version 1, type 1, name_length 11, reserved 0, followed by 11 bytes; result 27.
The shell reads into a 271-byte packet buffer and decodes u32 fields explicitly.
It validates packet version/type/length before formatting output.

Opening a directory takes a sorted snapshot: maximum 1024 entries and 64KiB of
serialized packet bytes per snapshot. A name longer than 255 bytes, invalid UTF-8
name representation or a snapshot exceeding these limits fails the open
atomically (-4 for size limits; -1 for invalid encoding). Existing file open/write
behavior and stored files are not truncated or rewritten to satisfy these limits.
A later mutation is visible only to a newly opened snapshot. Limits bound retained
snapshot memory; the current host cache scan is not a VM fuel guarantee.

## Directory and privacy model for the existing backend

The current VFS stores file bytes in a Map, not a native directory tree. For this
read-only directory slice, infer ancestors from visible normalized file paths.
Always provide virtual `/`, `/system`, `/apps`, `/home`, `/tmp`, `/shared` and
`/home/<current-app-id>`, including empty mount/home directories. Do not fabricate
installed package files from the browser app catalog or expose host filesystem
paths. Empty arbitrary subdirectories and persistent directory metadata require
a later mkdir/directory-storage contract.

Listing `/` returns `apps/`, `home/`, `shared/`, `system/`, `tmp/` in that order.
Listing `/home` exposes only the caller's own application directory. Direct access
to another application's home returns -3, even if no such files are present.
Infer descendants only from permitted files; preserve current `/shared` policy.
Root and per-app home listing must behave consistently in MemoryVfsAdapter and
the IndexedDB-hydrated adapter. Persist no cwd, directory cursors or snapshots.

Existing file storage can contain ambiguous file/ancestor paths. Never silently
present one name as both kinds. Opening a file path as a directory fails -9;
opening an ancestor whose immediate child is simultaneously a file and an
inferred directory fails -9 atomically. Do not rewrite those existing files or
alter legacy file creation semantics as part of this read-only slice.

## Responsibilities, lifecycle and files

- C++98 shell owns cwd/path resolution, command validation, packet decoding and
  display formatting. `cd` validates via opendir and immediately closes its handle.
  `ls` retains one directory handle, resumes across steps/output backpressure,
  then closes on EOF/error/exit. Pending output remains bounded at 4096 bytes.
- VFS owns path authorization, directory existence, typed handles, snapshot
  enumeration and quotas. Host imports only check/copy packets into guest memory.
  Register directory imports only when the adapter provides the operations.
  Add exact capability mappings and host grants; no permissive fallback stubs.
- Browser/Node boot and exit cleanup release every VFS file/directory handle,
  including traps and failed startup. Pass the declared openFiles limit through
  adapter creation, capped at the current host maximum 16. Current shell budget 4
  can cover one cat or ls handle; no limit increase is needed.
- `io.wasm` remains the real terminal and kernel.wasm stays scheduled; neither
  receives filesystem parsing, cwd state or command execution responsibilities.
- Modify only principal MaiaOS: VFS/host/capability adapters, shell source and
  manifest, scheduler lifecycle, tests and matching ABI/architecture docs. Rebuild
  shell through pinned MaiaCpp AST-strict -> C89 -> MaiaC/MaiaWASM. No compiler
  changes, new dependency pins, grammar changes, npm release or version bump are
  proposed. Report any toolchain defect before changing another repository.

## Acceptance tests

1. VFS root/empty/implicit/deep directories, sorted UTF-8 immediate children,
   file/directory ambiguity, private-home filtering and denied paths, snapshot
   stability, typed handles, limits and quota reuse.
2. Import buffer canaries, exact packet bytes (including the 27-byte example),
   malformed paths, insufficient capacity with cursor preserved, memory growth,
   missing requests/grants, wrong handle kinds and process-exit/trap cleanup.
3. Actual guest `ls`, `ls /system`, `cd /system`, `pwd`, `cd ..`, `cd` home,
   relative/quoted paths, excessive path length, missing targets, file targets,
   denied home, wrong arity; failed cd must retain cwd. Two guest instances must
   not share cwd; the simulator URL must remain unchanged.
4. Seeded nested and Unicode directory names via the real VFS test adapter;
   control-character names must print escaped and never clear the terminal.
   Large directory output must resume through a tiny stream ring without loss,
   spinning or kernel starvation; repeated ls/cd must release handles and keep
   guest stack/memory stable. Retain all existing command/error/input regressions.
5. Build strict C89, unit/stream/boot tests, actual kernel/I/O/shell LVGL integration,
   kernel/Calculator/Clock regression, then interactive browser when available.
   Reference results do not claim native-device or MaiaWASMVM conformance.

## Implementation evidence and publication boundary

The owner explicitly approved this exact implementation plan. All changes are
local to principal MaiaOS; no compiler, dependency gitlink, version, npm release,
commit or push changed during implementation. Baseline main/origin remains `160befe`.

Build: `npm run build:shell -- --check-c89` PASS; shell.wasm 1193137 bytes,
compiled by pinned MaiaCpp AST-strict -> C89 -> MaiaC/MaiaWASM. Generated grammar
and parser header remain byte-identical to the baseline. Cwd/path handling and
directory-packet decoding are guest logic, not a replacement shell parser.

Checks PASS: `npm test` (38), `npm run test:shell-directories`,
`npm run test:shell-host`, `npm run test:shell-lvgl`, `npm run test:shell-boot`,
`npm run test:io-streams`, `npm run test:lvgl-host`. Coverage includes the real guest
1024-entry listing through a 31-byte ring, two independent cwd memories, 1000 ls/cd
cycles, exact 1023-byte path bounds (including normalization at the limit), invalid
packets, denied capabilities, EOF and peer closure with an open directory, private
home filtering, snapshot/packet bounds and IndexedDB-adapter hydration through a
storage fixture. Actual LVGL session additionally keeps the kernel scheduled
through large directory output; shell 18 pages and I/O 2 pages remain stable.
Production boot functions pass 25 launch/exits plus a real guest import trap with
an open directory; all file/directory handles, streams and windows are released.

Interactive browser checks were not run; the integrated backend was unavailable
in the preceding milestone. These are reference-engine/LVGL results, not evidence
of native-device callbacks or MaiaWASMVM/fuel. The original approval covered implementation/verification only. On 2026-10-21,
the owner separately authorized commit and push of this complete MaiaOS slice.
No npm publication or version bump is included.
