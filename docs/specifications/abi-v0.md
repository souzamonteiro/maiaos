# MaiaOS Host ABI v0 (draft)

**Status:** The `maiaos-embedded-v0` kernel profile below is fixed for the browser/Node reference hosts. The wider OS ABI and device-host conformance remain proposed and incomplete. Stable namespaces use `maia.gfx`, `maia.vfs`, `maia.events`, `maia.process`, `maia.time`, `maia.stream`, and `maia.log`. The manifest declares requested capabilities; each host applies a separate policy. Functions use WASM numeric types and guest memory offsets; strings are UTF-8 with explicit lengths. Return `i32` status codes unless documented otherwise.

| Namespace      | Import signature (conceptual)                         | Purpose                   |
| -------------- | ----------------------------------------------------- | ------------------------- |
| `maia.log`     | `write(level:i32, ptr:i32, len:i32) -> i32`           | Bounded diagnostic output |
| `maia.gfx`     | `window_create(ptr:i32, len:i32) -> i32`              | Returns owned handle      |
| `maia.gfx`     | `label_create(parent:i32, ptr:i32, len:i32) -> i32`   | Returns owned handle      |
| `maia.gfx`     | `label_set_text(handle:i32, ptr:i32, len:i32) -> i32` | Updates an owned label    |
| `maia.gfx`     | `button_create(parent:i32, ptr:i32, len:i32) -> i32`  | Returns owned handle      |
| `maia.gfx`     | `object_destroy(handle:i32) -> i32`                   | Releases owned object     |
| `maia.events`  | `poll(out_ptr:i32, capacity:i32) -> i32`              | Returns bytes or status   |
| `maia.vfs`     | `open(path_ptr:i32, len:i32, flags:i32) -> i32`       | Returns file handle       |
| `maia.vfs`     | `read(fd:i32, out_ptr:i32, count:i32) -> i32`         | Bytes read or error       |
| `maia.vfs`     | `write(fd:i32, in_ptr:i32, count:i32) -> i32`         | Bytes written or error    |
| `maia.vfs`     | `opendir(path_ptr:i32, length:i32) -> i32` | Open directory snapshot |
| `maia.vfs`     | `readdir(fd:i32, out_ptr:i32, capacity:i32) -> i32` | One complete directory entry or EOF |
| `maia.vfs`     | `close(fd:i32) -> i32`                                | Closes file handle        |
| `maia.stream`  | `read(handle:i32, out_ptr:i32, capacity:i32) -> i32` | Copied bytes, EOF or status |
| `maia.stream`  | `write(handle:i32, ptr:i32, length:i32) -> i32` | Partial copied write or status |
| `maia.stream`  | `close(handle:i32) -> i32` | Close owned endpoint |
| `maia.time`    | `monotonic_ms() -> i64`                               | Monotonic clock           |
| `maia.process` | `exit(status:i32) -> void`                            | Exit current instance     |

## Status codes

`0 = OK`; negative values are `-1 = INVALID_ARGUMENT`, `-2 = NOT_FOUND`, `-3 = PERMISSION_DENIED`, `-4 = OUT_OF_MEMORY`, `-5 = UNSUPPORTED`, `-6 = WOULD_BLOCK`, `-7 = INVALID_HANDLE`, `-8 = CLOSED` (stream reader closed), and `-9 = NOT_DIRECTORY`. `-5` is reserved and is not returned by the current embedded profile. Calls returning handles use positive values on success; reads and writes return nonnegative byte counts, with zero indicating EOF for reads. Negative failures must never be confused with valid handles or byte counts.

## Event packet v0

`maia.events.poll(out_ptr:i32, capacity:i32) -> i32` copies one event into guest
memory. It returns the byte count, `-6 (WOULD_BLOCK)` when the queue is empty, or
another negative status on failure. Capacity must be at least 24 bytes. The
browser reference host uses a bounded 64-event FIFO; a full queue returns
`WOULD_BLOCK` without discarding queued events.

Fixed 24-byte little-endian header: `u32 version`, `u32 type`, `u32 objectHandle`,
`u32 data0`, `u32 data1`, `u32 reserved`. Version 1 event type `1` is
`GFX_CLICKED`; `objectHandle` identifies the LVGL-backed object, `data0/data1`
are zero, and `reserved` is zero. Type `2` is `KEY`: `objectHandle=0`,
`data0` is the text codepoint and `data1` is the key identifier (0 text, 1 Enter,
2 Backspace, 3 Left, 4 Right, 5 Home, 6 End, 7 Delete, 8 Up, 9 Down).
The initial canonical editor accepts printable ASCII only. Keyboard routing
requires the additional host capability `tty.input`. No pointers. Define a future extended payload
format with explicit lengths.

## Import linking

Imports are exact namespace/name/signature matches. Before instantiation, the browser host maps every module import to a capability, checks that the manifest requests it, then checks that host policy grants it. Unknown imports or missing requests/grants are rejected; WebAssembly compilation/instantiation validates signatures. Device hosts must apply the same two-stage capability check. Do not silently stub a security-sensitive call.

## Platform callback binding

The guest imports the stable `maia.*` names above; it does not receive callback
function pointers, inspect the host engine, or branch on browser/device identity.
Each platform registers the same import names and translates them to its own
callbacks:

| Contract             | Browser test host                                                                 | Tab5 device host                                                   |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Guest WASM execution | Browser native WebAssembly reference adapter, temporary until MaiaWASMVM is ready | MaiaWASMVM in the native platform firmware                         |
| `maia.gfx`           | Emscripten LVGL-WASM module; copied text/handles cross the JS callback boundary   | Native LVGL calls marshalled to the designated LVGL task           |
| Display flush        | LVGL emits RGB565 areas; JavaScript presents those already-rendered pixels        | LVGL/display callback forwards pixels to the Tab5 display driver   |
| Input/events         | DOM touch/key events are normalized and delivered through the host binding        | Touch and keyboard drivers feed the same normalized event contract |
| Storage/services     | Browser adapters with explicit limits and permissions                             | ESP-IDF, microSD, and native service callbacks                     |

The browser canvas, if used, is only an output surface for LVGL flush images; it
must not implement or simulate MaiaOS widgets. The Emscripten LVGL module is a
platform service separate from the MaiaOS guest and from the temporary native
guest engine. Changing hosts replaces callback bindings, not the guest module.
Native-engine results must be labeled reference results and must not imply
MaiaWASM validation, fuel enforcement, or scheduling.

### Kernel guest v0 binary contract

The current C++98 kernel guest is compiled as freestanding `kernel.wasm` with
memory32. Its exact imports are:

| Import                    | WASM signature                                             | Meaning                            |
| ------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| `maia.gfx.window_create`  | `(i32 text_ptr, i32 text_len) -> i32 handle`               | Create an LVGL-backed window       |
| `maia.gfx.label_create`   | `(i32 parent, i32 text_ptr, i32 text_len) -> i32 handle`   | Create a label under a window      |
| `maia.gfx.label_set_text` | `(i32 label, i32 text_ptr, i32 text_len) -> i32 status`    | Update an owned label              |
| `maia.gfx.button_create`  | `(i32 parent, i32 text_ptr, i32 text_len) -> i32 handle`   | Create a button under a window     |
| `maia.events.poll`        | `(i32 out_ptr, i32 capacity) -> i32 bytes/status`          | Poll one bounded event packet      |
| `maia.vfs.open`           | `(i32 path_ptr, i32 path_len, i32 flags) -> i32 handle`    | Open a path in the guest namespace |
| `maia.vfs.read`           | `(i32 handle, i32 out_ptr, i32 count) -> i32 bytes/status` | Copy file bytes into guest memory  |
| `maia.vfs.write`          | `(i32 handle, i32 in_ptr, i32 count) -> i32 bytes/status`  | Copy guest bytes into a file       |
| `maia.vfs.close`          | `(i32 handle) -> i32 status`                               | Close an open-file handle          |
| `maia.log.write`          | `(i32 level, i32 text_ptr, i32 text_len) -> i32 status`    | Write bounded diagnostic text      |

VFS flags are bitwise: `READ=1`, `WRITE=2`, `CREATE=4`, `TRUNCATE=8`. Paths are
absolute UTF-8 guest paths, normalized before lookup. A host binds each VFS
adapter to one app ID and confines that guest to `/home/<app-id>`; it allows
writes there, under `/tmp`, and under policy-controlled `/shared`. `/system` and
`/apps` are read-only. The browser hydrates only that app's home subtree plus
`/shared` from IndexedDB before guest startup and persists changes asynchronously
while VFS imports remain synchronous. `/tmp` is volatile. The device host must
apply equivalent mount and capability policy.

Required exports are `memory`, `maiaos_start() -> void`, and
`maiaos_step() -> void`. The browser launcher verifies import capabilities
before instantiation and the integration test checks both accepted imports and
missing manifest or host grants. The host invokes `maiaos_start` after
instantiation and
guest-memory attachment, then schedules `maiaos_step` from its own event loop or
device scheduler. The kernel polls `maia.events`; the host does not call a
platform-specific guest event callback and does not pass native pointers.
Toolchain support exports may be present and are not part of the MaiaOS ABI.
The current kernel imports the ten names listed above. New imports require an
additive ABI change, a capability mapping, a host-policy grant, and integration
coverage; existing signatures are not changed within this profile.

This is the first vertical-slice contract, not a complete kernel syscall ABI.
Process lifecycle, capabilities, persistent event semantics, scheduling and VM
fuel still need explicit signatures and tests before the kernel grows to depend
on them. The Node reference VFS is in-memory; the browser adapter persists each
app's private home subtree and `/shared` through IndexedDB.

## Bounded stream and shell/I/O reference profile

Approved additive extension, implemented 2026-10-20. Imports map to capabilities
`stream.read`, `stream.write`, `stream.close`, with separate manifest request and
host grant checks. Existing imports/signatures remain unchanged. Stream imports
are registered only when a broker and a process identity are supplied.

Each pipe owns a 4096-byte ring by default; the maximum copy is 4096 bytes per
call. The reference broker has 64 pipes globally and 16 endpoints per process.
Privileged boot setup can select a smaller ring (1..4096 bytes); guests cannot
create arbitrary endpoints. Handles are process local and do not reveal pointers.
Writes copy bytes into the ring; reads copy them into the caller's memory.
Neither operation interprets UTF-8. Validate the entire requested guest range and
size before consuming or copying anything: bad arguments/ranges return -1 with
no partial transfer. Wrong direction returns -3; unknown/closed handles return -7.
A valid zero-length call returns 0 without changing state, even if its peer closed.

Empty live reads and full writes return -6. A nonempty write after the final
reader closes returns -8. After the final writer closes, reads drain buffered
bytes then return 0 (EOF). Partial writes are allowed; each guest must retain the
unwritten suffix, yield and resume in later steps. There is no readiness event
in this profile. Close returns 0 once, then -7; process exit/trap/startup cleanup
closes every owned endpoint. Descriptor aliases keep the endpoint direction alive
until its final alias closes. Buffers are released after both directions close.

The boot coordinator creates these bindings before starting I/O then the shell:

| Guest | Handle | Direction | Binding |
|---|---|---|---|
| shell | 0 | read | stdin from I/O |
| shell | 1 | write | stdout to terminal |
| shell | 2 | write | stderr, alias of stdout for this terminal profile |
| I/O | 3 | write | canonical stdin to shell |
| I/O | 4 | read | terminal output |
| I/O | 5 | read | alias of terminal output |

Using one terminal output pipe preserves the actual order of writes to stdout
and stderr, including errors followed by a prompt. Handles 1/2 remain distinct
logical descriptors; this boot profile attaches both to the same TTY sink.
It does not implement arbitrary pipelines, descriptor transfer, spawning, or a
complete POSIX fd ABI. Stream and VFS handles belong to separate namespaces.

`io.wasm` exports `maia_io_start` and `maiaos_step`; it imports only gfx,
events, stream and process calls. It owns keyboard editing, one-line history,
canonical input and LVGL output. `shell.wasm` exports `maia_app_start` and
`maiaos_step`; it imports stream, VFS and process calls plus toolchain support.
It owns prompt bytes, generated lexing/parsing and builtin execution; it never
imports graphics/events. The host transports bytes and schedules each guest;
`kernel.wasm` remains scheduled in a third isolated memory. Exit drains output
before I/O observes EOF and tears down its window. Startup failures release both
sets of endpoints and any created I/O window.

Current limits: 255 ASCII editable bytes, 4096-byte terminal history, 256-byte
pending canonical input, 4096-byte pending shell output. I/O decodes output UTF-8
incrementally, replacing invalid/truncated sequences with U+FFFD, preserving
codepoint boundaries when truncating display text. It supports the shell's
`ESC[2J` clear and `ESC[H` home sequence only, not a full ANSI terminal. History
resets at its fixed limit. Initial measured memories: I/O 2 pages, shell 18 pages;
manifest startup budgets: 8 and 32 respectively. Runtime memory/fuel enforcement
and native-device stream bindings are separate pending work.

Checks: `npm test`, `npm run test:io-streams`, `npm run test:shell-host`,
`npm run test:shell-lvgl`, `npm run test:shell-boot`, `npm run test:lvgl-host`.
These exercise actual guest WASM on the native reference engine and actual LVGL
in the GUI checks; they do not establish browser interaction or device conformance.

## Directory enumeration reference extension

Owner-approved additive extension, implemented 2026-10-20. Imports `maia.vfs.opendir`
and `maia.vfs.readdir` map to capabilities `vfs.opendir` and `vfs.readdir`;
`maia.vfs.close` closes both file and directory handles. Imports are available
only if the adapter provides both directory operations. Each guest requests the
capabilities and the host independently grants them. Existing signatures remain.

`opendir` takes an absolute, strict UTF-8 path of 1..1023 bytes and returns a
positive snapshot handle. Directory handles share the adapter's file-handle
namespace/quota; stream handles remain separate. Files/ancestors required as
directories return -9; missing directories -2; denied private homes -3; invalid
encoding/path -1; quota or snapshot size exhaustion -4. Normalize and authorize
before checking existence; the caller cannot probe another application's home.
Read/write on directory handles and readdir on file handles return -1; unknown
or closed handles return -7. Close succeeds once. Process exit/trap/failed startup
releases all VFS handles. The browser passes the manifest openFiles limit through
to both VFS adapters, capped at 16; the shell keeps its existing budget of 4.

`readdir` accepts capacity 16..4096 and returns one complete entry, or 0 at EOF.
The complete requested memory range is checked before advancing the cursor.
A valid buffer smaller than the next packet returns -4 without changing memory
or cursor; invalid size/range returns -1. Header fields are explicit little-endian
u32 values; no native pointers, padding or implicit terminator:

| Offset | Field | Value |
|---|---|---|
| 0 | version | 1 |
| 4 | type | 1 file, 2 directory |
| 8 | name_length | 1..255 UTF-8 bytes |
| 12 | reserved | 0 |
| 16 | name bytes | Exactly name_length bytes, no slash/NUL/terminator |

Return count is `16 + name_length` (at most 271). The `/system/welcome.txt`
entry is 27 bytes. Snapshot entries are sorted by UTF-8 byte order and limited
to 1024 entries / 64KiB of serialized packets. Malformed UTF-8 names fail opening
with -1; oversized names/snapshots fail atomically with -4. Later file mutations
appear only in a fresh snapshot. These limits bound retained memory, not VM fuel.

The reference backend infers directories from authorized file paths. Root,
`/system`, `/apps`, `/home`, `/tmp`, `/shared`, and the caller's own home always
exist, even when empty. `/home` lists only the caller's ID. It does not enumerate
browser app catalogs or native host paths. Empty arbitrary directories are not
represented without future mkdir/storage semantics. Ambiguous file/ancestor
names fail directory opening with -9; existing files are never silently rewritten.
The IndexedDB adapter derives the same view after private-home/shared hydration.

The C++98 shell owns cwd, initially `/`, and lexically normalizes relative paths,
`.` and `..` (clamped at root), rejecting normalized paths longer than 1023 bytes.
`cd [path]` validates by opening/closing a directory before updating cwd; no operand
selects `/home/org.maiaplatform.shell`. `pwd` reports that instance's cwd. `ls [path]`
defaults to cwd, lists immediate children including dot-prefixed names, omits
`.`/`..`, appends `/` to directories, and escapes backslash/control bytes before
sending output through its existing bounded stream queue. It resumes listing
across steps/backpressure and closes the snapshot at EOF/error/exit. Guest code
validates entry packet headers, type, lengths and forbidden name bytes before
printing. I/O still owns the real LVGL terminal; the kernel remains scheduled.

No options, symlinks, HOME/OLDPWD expansion, mutable directory APIs,
spawn, pipelines or full POSIX behavior are added. Browser URL and host cwd remain
unchanged. See [the approved contract](../planning/SHELL_VFS_DIRECTORIES.md).
Checks: `npm test`, `npm run test:shell-directories`, `npm run test:shell-lvgl`,
`npm run test:shell-boot`, `npm run test:io-streams`, `npm run test:lvgl-host`.

## Read-only cat consumer extension (2026-10-21)

No ABI/import/capability change. The initial slice normalizes one file operand using
its own cwd and the existing 1023-byte path limit, then calls existing
`maia.vfs.open/read/close` with READ only. Output preserves file bytes and adds no
newline. Missing/excess operands and options produce a usage diagnostic; stdin,
multiple files and write/redirection behavior remain outside this slice. The
current file-open errors remain authoritative, including generic missing/file-
versus-directory failure. No stat or directory probe is added to emulate a
missing file API distinction. Permission/quota/path/read errors go to stderr.

The existing state machine yields under bounded stream backpressure and closes
files at EOF/error/exit; host teardown closes them after a trap. I/O renders the
same copied bytes through the existing terminal/LVGL profile. Raw 128KiB binary
transfer, 31-byte rings, cwd/private-home authorization, read errors after partial
output, EOF/closed-peer cleanup and 1000 reads are covered by
`npm run test:shell-files`; full kernel/I/O/shell rendering is covered by
`npm run test:shell-lvgl`. See [the behavior/test contract](../planning/SHELL_CAT_READ_ONLY.md).

## Evolution

Freeze the wider ABI only after reference and device integration tests. Add APIs additively and preserve versioned compatibility. Avoid assuming Memory64 addresses fit in i32; this profile explicitly requires memory32.

## Multi-file cat consumer extension

The shell now accepts `cat <file> [file ...]`, preserving existing VFS/stream
imports and capabilities. It consumes the final expanded argv in order, opens
one READ file at a time and concatenates exact bytes without extra separators.
Errors close the current file and continue with later operands; one prompt
follows completion. No stdin/options/exit-status extension is introduced.
See [multi-file contract](../planning/SHELL_CAT_MULTIPLE_FILES.md) for exact
limits, error policy and actual WASM/LVGL verification.
