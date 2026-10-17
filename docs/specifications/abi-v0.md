# MaiaOS Host ABI v0 (draft)

**Status:** The `maiaos-embedded-v0` kernel profile below is fixed for the browser/Node reference hosts. The wider OS ABI and device-host conformance remain proposed and incomplete. Stable namespaces use `maia.gfx`, `maia.vfs`, `maia.events`, `maia.process`, `maia.time`, and `maia.log`. The manifest declares requested capabilities; each host applies a separate policy. Functions use WASM numeric types and guest memory offsets; strings are UTF-8 with explicit lengths. Return `i32` status codes unless documented otherwise.

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
| `maia.vfs`     | `close(fd:i32) -> i32`                                | Closes file handle        |
| `maia.time`    | `monotonic_ms() -> i64`                               | Monotonic clock           |
| `maia.process` | `exit(status:i32) -> void`                            | Exit current instance     |

## Status codes

`0 = OK`; negative values are `-1 = INVALID_ARGUMENT`, `-2 = NOT_FOUND`, `-3 = PERMISSION_DENIED`, `-4 = OUT_OF_MEMORY`, `-5 = UNSUPPORTED`, `-6 = WOULD_BLOCK`, and `-7 = INVALID_HANDLE`. `-5` is reserved and is not returned by the current embedded profile. Calls returning handles use positive values on success; reads and writes return nonnegative byte counts, with zero indicating EOF for reads. Negative failures must never be confused with valid handles or byte counts.

## Event packet v0

`maia.events.poll(out_ptr:i32, capacity:i32) -> i32` copies one event into guest
memory. It returns the byte count, `-6 (WOULD_BLOCK)` when the queue is empty, or
another negative status on failure. Capacity must be at least 24 bytes. The
browser reference host uses a bounded 64-event FIFO; a full queue returns
`WOULD_BLOCK` without discarding queued events.

Fixed 24-byte little-endian header: `u32 version`, `u32 type`, `u32 objectHandle`,
`u32 data0`, `u32 data1`, `u32 reserved`. Version 1 event type `1` is
`GFX_CLICKED`; `objectHandle` identifies the LVGL-backed object, `data0/data1`
are zero, and `reserved` is zero. No pointers. Define a future extended payload
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

## Evolution

Freeze the wider ABI only after reference and device integration tests. Add APIs additively and preserve versioned compatibility. Avoid assuming Memory64 addresses fit in i32; this profile explicitly requires memory32.
