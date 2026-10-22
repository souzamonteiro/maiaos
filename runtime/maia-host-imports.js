import { STREAM_MAX_COPY } from "./maia-streams.js";

const STATUS = Object.freeze({
  OK: 0,
  INVALID_ARGUMENT: -1,
  PERMISSION_DENIED: -3,
  OUT_OF_MEMORY: -4,
  WOULD_BLOCK: -6,
  INVALID_HANDLE: -7,
  CLOSED: -8,
  NOT_DIRECTORY: -9,
});
const EVENT_PACKET_VERSION = 1;
const EVENT_PACKET_BYTES = 24;
const EVENT_QUEUE_CAPACITY = 64;
export const MAIA_EVENT_GFX_CLICKED = 1;
export const MAIA_EVENT_KEY = 2;
export const MAIA_KEY_TEXT = 0;
export const MAIA_KEY_ENTER = 1;
export const MAIA_KEY_BACKSPACE = 2;
export const MAIA_KEY_LEFT = 3;
export const MAIA_KEY_RIGHT = 4;
export const MAIA_KEY_HOME = 5;
export const MAIA_KEY_END = 6;
export const MAIA_KEY_DELETE = 7;
export const MAIA_KEY_UP = 8;
export const MAIA_KEY_DOWN = 9;

function validateGuestRange(memory, pointer, length) {
  if (
    !memory ||
    !Number.isInteger(pointer) ||
    !Number.isInteger(length) ||
    pointer < 0 ||
    length < 0
  ) {
    throw new RangeError("Invalid guest memory range");
  }
  const end = pointer + length;
  if (!Number.isSafeInteger(end) || end > memory.buffer.byteLength) {
    throw new RangeError(
      `Guest memory range ${pointer}:${length} is out of bounds`,
    );
  }
  return end;
}

function readGuestText(memory, pointer, length) {
  validateGuestRange(memory, pointer, length);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      new Uint8Array(memory.buffer, pointer, length),
    );
  } catch {
    throw new TypeError(
      `Guest text at ${pointer} (${length} bytes) is not valid UTF-8`,
    );
  }
}

export function createMaiaHostImports({
  graphics,
  vfs,
  tty = null,
  streams = null,
  processId = null,
  log = () => {},
  monotonicMs = () => globalThis.performance.now(),
  onProcessExit = () => {},
}) {
  if (!graphics)
    throw new TypeError("A platform graphics callback table is required");
  for (const name of [
    "windowCreate",
    "labelCreate",
    "labelSetText",
    "buttonCreate",
    "objectDestroy",
  ]) {
    if (typeof graphics[name] !== "function")
      throw new TypeError(`Missing graphics callback: ${name}`);
  }
  for (const name of ["open", "read", "write", "close"]) {
    if (!vfs || typeof vfs[name] !== "function") {
      throw new TypeError(`Missing VFS callback: ${name}`);
    }
  }
  if (
    tty &&
    (typeof tty.pollLine !== "function" || typeof tty.write !== "function")
  ) {
    throw new TypeError("TTY must provide pollLine and write callbacks");
  }
  if (streams && (!Number.isInteger(processId) || processId <= 0
      || ["read", "write", "close", "closeProcess"].some(name => typeof streams[name] !== "function"))) {
    throw new TypeError("Streams require a broker and positive process identity");
  }

  let guestMemory = null;
  let guestInstance = null;
  let heapTop = null;
  const eventQueue = [];
  const text = (pointer, length) => readGuestText(guestMemory, pointer, length);
  const allocate = (size) => {
    if (!guestMemory || !Number.isFinite(Number(size))) return 0;
    const requested = Math.max(1, Number(size) >>> 0);
    if (typeof guestInstance?.exports?.malloc === "function") {
      return guestInstance.exports.malloc(requested);
    }
    const alignDown = (value) => Math.floor(value / 8) * 8;
    if (heapTop === null) heapTop = guestMemory.buffer.byteLength;

    const stackGlobal = guestInstance?.exports?.__stack_ptr;
    const stackFloor = stackGlobal && Number.isFinite(Number(stackGlobal.value))
      ? Math.max(1024, Number(stackGlobal.value))
      : 1024;
    let pointer = alignDown(heapTop - requested);
    if (pointer < stackFloor) {
      try {
        const missingBytes = stackFloor - pointer;
        guestMemory.grow(Math.ceil(missingBytes / 65536) + 1);
        heapTop = guestMemory.buffer.byteLength;
        pointer = alignDown(heapTop - requested);
      } catch {
        return 0;
      }
    }
    if (pointer < stackFloor) return 0;

    heapTop = pointer;
    return pointer;
  };
  const imports = {
    env: {
      __malloc: allocate,
      __free: (pointer) => {
        if (typeof guestInstance?.exports?.free === "function") guestInstance.exports.free(pointer);
      },
      // MaiaC libc manages guest allocations; the host supplies WASM primitives.
      __builtin_wasm_memory_size: (index) =>
        index === 0 && guestMemory ? guestMemory.buffer.byteLength / 65536 : -1,
      __builtin_wasm_memory_grow: (index, pages) => {
        if (index !== 0 || !guestMemory || !Number.isInteger(pages) || pages < 0) return -1;
        try { return guestMemory.grow(pages); } catch { return -1; }
      },
    },
    "maia.gfx": {
      window_create: (pointer, length) =>
        graphics.windowCreate(text(pointer, length)),
      label_create: (parent, pointer, length) =>
        graphics.labelCreate(parent, text(pointer, length)),
      label_set_text: (handle, pointer, length) =>
        graphics.labelSetText(handle, text(pointer, length)),
      button_create: (parent, pointer, length) =>
        graphics.buttonCreate(parent, text(pointer, length)),
      object_destroy: (handle) => graphics.objectDestroy(handle),
    },
    "maia.events": {
      poll: (pointer, capacity) => {
        if (!Number.isInteger(capacity) || capacity < EVENT_PACKET_BYTES) {
          return STATUS.INVALID_ARGUMENT;
        }
        if (eventQueue.length === 0) return STATUS.WOULD_BLOCK;
        try {
          validateGuestRange(guestMemory, pointer, EVENT_PACKET_BYTES);
        } catch {
          return STATUS.INVALID_ARGUMENT;
        }

        const event = eventQueue.shift();
        const packet = new DataView(
          guestMemory.buffer,
          pointer,
          EVENT_PACKET_BYTES,
        );
        packet.setUint32(0, EVENT_PACKET_VERSION, true);
        packet.setUint32(4, event.type, true);
        packet.setUint32(8, event.objectHandle, true);
        packet.setUint32(12, event.data0, true);
        packet.setUint32(16, event.data1, true);
        packet.setUint32(20, 0, true);
        return EVENT_PACKET_BYTES;
      },
    },
    "maia.vfs": {
      open: (pointer, length, flags) => {
        if (!Number.isInteger(length) || length < 1 || length > 1023) return STATUS.INVALID_ARGUMENT;
        try {
          return vfs.open(text(pointer, length), flags);
        } catch {
          return STATUS.INVALID_ARGUMENT;
        }
      },
      read: (handle, pointer, count) => {
        try {
          validateGuestRange(guestMemory, pointer, count);
        } catch {
          return STATUS.INVALID_ARGUMENT;
        }
        const result = vfs.read(handle, count);
        if (typeof result === "number") return result;
        new Uint8Array(guestMemory.buffer, pointer, result.byteLength).set(
          result,
        );
        return result.byteLength;
      },
      write: (handle, pointer, count) => {
        if (!Number.isInteger(count) || count < 0 || count > 4096) return STATUS.INVALID_ARGUMENT;
        try {
          validateGuestRange(guestMemory, pointer, count);
        } catch {
          return STATUS.INVALID_ARGUMENT;
        }
        const bytes = new Uint8Array(
          guestMemory.buffer,
          pointer,
          count,
        ).slice();
        return vfs.write(handle, bytes);
      },
      close: (handle) => vfs.close(handle),
    },
    "maia.log": {
      write: (level, pointer, length) => {
        log(level, text(pointer, length));
        return STATUS.OK;
      },
    },
    "maia.process": {
      exit: (exitCode) => {
        if (streams) streams.closeProcess(processId);
        if (typeof vfs.closeAll === "function") vfs.closeAll();
        onProcessExit(exitCode);
      },
    },
    "maia.time": {
      monotonic_ms: () => BigInt(Math.max(0, Math.trunc(monotonicMs()))),
    },
  };

  if (typeof vfs.opendir === "function" && typeof vfs.readdir === "function") {
    imports["maia.vfs"].opendir = (pointer, length) => {
      if (!Number.isInteger(length) || length < 1 || length > 1023) return STATUS.INVALID_ARGUMENT;
      try {
        validateGuestRange(guestMemory, pointer, length);
        const path = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(new Uint8Array(guestMemory.buffer, pointer, length));
        return vfs.opendir(path);
      }
      catch { return STATUS.INVALID_ARGUMENT; }
    };
    imports["maia.vfs"].readdir = (handle, pointer, capacity) => {
      if (!Number.isInteger(capacity) || capacity < 16 || capacity > 4096) return STATUS.INVALID_ARGUMENT;
      try { validateGuestRange(guestMemory, pointer, capacity); }
      catch { return STATUS.INVALID_ARGUMENT; }
      const result = vfs.readdir(handle, capacity);
      if (typeof result === "number") return result;
      new Uint8Array(guestMemory.buffer, pointer, result.length).set(result);
      return result.length;
    };
  }

  if (streams) {
    imports["maia.stream"] = {
      read: (handle, pointer, capacity) => {
        if (!Number.isInteger(capacity) || capacity < 0 || capacity > STREAM_MAX_COPY) return STATUS.INVALID_ARGUMENT;
        try { validateGuestRange(guestMemory, pointer, capacity); }
        catch { return STATUS.INVALID_ARGUMENT; }
        const result = streams.read(processId, handle, capacity);
        if (typeof result === "number") return result;
        new Uint8Array(guestMemory.buffer, pointer, result.length).set(result);
        return result.length;
      },
      write: (handle, pointer, length) => {
        if (!Number.isInteger(length) || length < 0 || length > STREAM_MAX_COPY) return STATUS.INVALID_ARGUMENT;
        try { validateGuestRange(guestMemory, pointer, length); }
        catch { return STATUS.INVALID_ARGUMENT; }
        return streams.write(processId, handle, new Uint8Array(guestMemory.buffer, pointer, length));
      },
      close: handle => streams.close(processId, handle),
    };
  }

  if (tty) {
    imports["maia.tty"] = {
      poll_line: (pointer, capacity) => {
        if (!Number.isInteger(capacity) || capacity < 0) {
          return STATUS.INVALID_ARGUMENT;
        }
        const line = tty.pollLine(capacity);
        if (line === null || line === undefined) return STATUS.WOULD_BLOCK;
        const bytes = new TextEncoder().encode(String(line));
        if (bytes.byteLength > capacity) return STATUS.INVALID_ARGUMENT;
        try {
          validateGuestRange(guestMemory, pointer, bytes.byteLength);
        } catch {
          return STATUS.INVALID_ARGUMENT;
        }
        new Uint8Array(guestMemory.buffer, pointer, bytes.byteLength).set(bytes);
        return bytes.byteLength;
      },
      write: (stream, pointer, length) => {
        if ((stream !== 1 && stream !== 2) || !Number.isInteger(length)) {
          return STATUS.INVALID_ARGUMENT;
        }
        let message;
        try {
          message = readGuestText(guestMemory, pointer, length);
        } catch {
          return STATUS.INVALID_ARGUMENT;
        }
        tty.write(stream, message);
        return length;
      },
    };
  }

  return Object.freeze({
    imports,
    status: STATUS,
    attachInstance(instance) {
      const memory = instance && instance.exports && instance.exports.memory;
      if (!(memory instanceof WebAssembly.Memory)) {
        throw new TypeError(
          "The guest must export its memory before Maia imports can read guest buffers",
        );
      }
      guestMemory = memory;
      guestInstance = instance;
      heapTop = memory.buffer.byteLength;
    },
    attachMemory(memory) {
      if (!(memory instanceof WebAssembly.Memory))
        throw new TypeError("Expected a WebAssembly.Memory");
      guestMemory = memory;
      guestInstance = null;
      heapTop = memory.buffer.byteLength;
    },
    readGuestText(pointer, length) {
      return text(pointer, length);
    },
    enqueueEvent(event) {
      if (eventQueue.length >= EVENT_QUEUE_CAPACITY) return STATUS.WOULD_BLOCK;
      const packet = {
        type: event.type,
        objectHandle: event.objectHandle,
        data0: event.data0 ?? 0,
        data1: event.data1 ?? 0,
      };
      for (const [field, value] of Object.entries(packet)) {
        if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
          return STATUS.INVALID_ARGUMENT;
        }
      }
      eventQueue.push(packet);
      return STATUS.OK;
    },
    get queuedEventCount() {
      return eventQueue.length;
    },
    closeFiles() {
      if (typeof vfs.closeAll === "function") vfs.closeAll();
    },
    closeStreams() {
      if (streams) streams.closeProcess(processId);
    },
  });
}
