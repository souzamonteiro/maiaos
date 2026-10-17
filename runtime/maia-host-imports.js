const STATUS = Object.freeze({
  OK: 0,
  INVALID_ARGUMENT: -1,
  OUT_OF_MEMORY: -4,
  WOULD_BLOCK: -6,
  INVALID_HANDLE: -7,
});
const EVENT_PACKET_VERSION = 1;
const EVENT_PACKET_BYTES = 24;
const EVENT_QUEUE_CAPACITY = 64;
export const MAIA_EVENT_GFX_CLICKED = 1;

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
  return new TextDecoder("utf-8", { fatal: true }).decode(
    new Uint8Array(memory.buffer, pointer, length),
  );
}

export function createMaiaHostImports({
  graphics,
  vfs,
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

  let guestMemory = null;
  const eventQueue = [];
  const text = (pointer, length) => readGuestText(guestMemory, pointer, length);
  const imports = {
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
      exit: (exitCode) => onProcessExit(exitCode),
    },
    "maia.time": {
      monotonic_ms: () => BigInt(Math.max(0, Math.trunc(monotonicMs()))),
    },
  };

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
    },
    attachMemory(memory) {
      if (!(memory instanceof WebAssembly.Memory))
        throw new TypeError("Expected a WebAssembly.Memory");
      guestMemory = memory;
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
  });
}
