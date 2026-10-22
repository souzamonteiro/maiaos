# Output redirection contract for review

2026-10-22. Third owner-requested slice, after multi-file cat and the four legacy
C89 diagnostics. Status: approved by the owner on 2026-10-22 ("Pode seguir"), following
explicit review of the public host contract (AGENTS.md 2.8 / 4.6). No new
version/npm/publication is implied. Pipelines remain the following slice.

## User-visible behavior

Support one stdout redirection on one simple command: `command ... > word` and
`command ... >> word`. Use the existing generated shell Redirection tree and
MaiaCC EBNF; never parse operators in host JavaScript or replace lexing by hand.
Retain current rejection of compound execution, input redirection, numbered fds,
duplication, heredocs, background commands and multiple redirects. Reject these
before dispatch or filesystem mutation. Existing unsupported grammar boundaries
remain documented; grammar changes, if needed, must regenerate both targets and
pass exact JS/native/WASM token/tree parity first.

Decode quote/escape provenance as today and expand argv plus the target through
MaiaGlob. The target must resolve to exactly one word; multiple matches produce
an ambiguous-redirection error before any open/truncate. An unmatched pattern
remains literal as with current argv expansion. Keep 255 input bytes, 32 tokens,
1024 tree nodes, 12 evaluated/expanded words including the target, 95 bytes per
word, 1023 normalized path bytes and existing per-process handle/memory quotas.

Open the target after syntax/expansion validation but before builtin invocation,
as in shell redirection: `>` creates or truncates; `>>` creates or appends.
A builtin usage error can therefore leave an already created/truncated output
file, whereas syntax/expansion/open failure never runs the command. Failed opens
leave an existing file unchanged. Redirection affects command stdout only;
stderr, startup messages, diagnostics and the next prompt stay on terminal
streams. `cat a a > out` concatenates exact bytes; redirecting a file onto itself
with `>` truncates before input open, rather than inventing a copy-file shortcut.

Output uses a bounded queue and partial-write offset. Drain before closing the
target/restoring terminal stdout; emit one prompt after completion. A write error
cancels further command work, closes input/output handles, preserves bytes already
accepted, reports a terminal diagnostic and leaves the shell usable. It is not a
transactional whole-command write. Closed terminal peers/traps/exit close every
handle through the existing lifecycle. No host executes builtins or matches globs.

## Exact additive VFS contract

Keep signatures `open(ptr:i32,len:i32,flags:i32)->i32`,
`write(fd:i32,ptr:i32,count:i32)->i32`, `close(fd:i32)->i32`.
Add `APPEND=16` to flags READ=1, WRITE=2, CREATE=4, TRUNCATE=8. Accepted mask becomes
0x1f. APPEND requires WRITE and cannot combine with TRUNCATE; those combinations
return INVALID_ARGUMENT (-1). Preserve existing non-append flag compatibility.
`>` uses WRITE|CREATE|TRUNCATE (14); `>>` uses WRITE|CREATE|APPEND (22).

APPEND selects current EOF at each write, including when another live handle has
written since open. This must operate on one shared backing record, atomically
per write within the reference host, not by reading to EOF or per-instance stale
snapshots. File positions and handle quotas remain private to each process.
Existing READ handles observe current bytes of the same backing record, as the
memory VFS already does within one adapter. Device hosts will require the same
serialization contract; no device implementation is claimed by browser tests.

Writable mounts: /tmp, /shared and /home/<effective-app-id>. /system and /apps
remain read-only; foreign homes remain denied (-3), including through normalized
dot components. Do not allow writing a virtual/implicit directory as a file
(INVALID_ARGUMENT -1), or a descendant beneath a file (NOT_DIRECTORY -9). Keep the
current file-derived implicit directories; this does not add mkdir or symlinks.
All checks and quota reservations precede create/truncate/write side effects.
Handle exhaustion/storage limits/allocation failure return OUT_OF_MEMORY (-4),
invalid memory/count/flags return -1, missing non-created files -2 and invalid
handles -7. No new status code is needed. Do not leak exceptions as success.

Reference-profile write limits: at most 4096 bytes per write import, 1 MiB per
writable file, 8 MiB total writable store and 4096 writable records. Enforce
integer/overflow/copy bounds before allocating or mutating. A failed operation
leaves bytes, positions, record count and handles unchanged. Existing oversized
persistent records remain readable; writes that grow/retain an over-limit result
fail until the file is truncated/reduced. Zero-byte writes validate identity,
permission and memory bounds, return 0, and do not change bytes or positions.

## Backing-store and persistence boundary

Add an internal shared VFS store in runtime/maia-vfs-store.js. Adapters retain
per-app authorization and per-process handle tables; they optionally share the
store. Standalone MemoryVfsAdapter defaults to its own store, preserving isolated
fixtures. Browser boot creates one backing store for its app sessions and uses
one IndexedDB persistence queue. Host storage state may contain private records;
no guest can enumerate/read another app's namespace. Matching remains guest code.

Hydrate normalized records once, preserve current legacy kernel-home migration,
and make create/truncate/write visible to all authorized adapters immediately.
This fixes the stale per-instance snapshot issue before claiming shared append.
Keep copied-byte ownership and directory snapshot semantics. Persistence remains
asynchronous and host flush/error reporting remains authoritative: successful
write/close means accepted in the bounded reference VFS, not durable microSD or
fsync completion. No new guest sync syscall or durability guarantee is implied.

Request existing `vfs.write` capability in the shell manifest and explicitly
grant it in the browser reference policy. Manifest requests and host grants are
both checked; tests must demonstrate denial before instantiation/file mutation.
The kernel remains scheduled; io.wasm owns LVGL/events. Do not add DOM terminals.

## Reviewable implementation and acceptance

Affected production paths: shell C++98 command/word/finalization state, existing
build script/guest artifact, VFS/store/reference imports, browser store lifecycle,
manifest/grants and ABI docs. No compiler change is presumed for this slice.

Actual WASM tests: echo/cat > and >>, quoted/glob/ambiguous targets, empty output,
zero/missing/readonly/foreign/directory paths, exact binary bytes, partial writes
and errors after a prefix, one prompt, EOF, slow/closed peers, cleanup/reuse and
unchanged argv limits. Store tests cover two independently owned adapters sharing
one record, interleaved append writes, live-reader visibility, independent handles,
private-home isolation, atomic quota failures, copied buffers, hydration/migration
and persistence-error reporting. Actual kernel/I/O/LVGL and all existing shell,
VFS/stream/parser parity regressions must pass. Do not commit/push this proposal
or implementation without publication authorization.
