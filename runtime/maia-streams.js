// Host transport only: bounded copied bytes and per-process endpoint ownership.
export const STREAM_STATUS = Object.freeze({
  OK: 0, INVALID_ARGUMENT: -1, PERMISSION_DENIED: -3,
  WOULD_BLOCK: -6, INVALID_HANDLE: -7, CLOSED: -8,
});
export const STREAM_MAX_COPY = 4096;

const validInteger = (value, minimum = 0) => Number.isInteger(value)
  && value >= minimum && value <= 0x7fffffff;

export class MaiaStreamBroker {
  constructor({ maxPipes = 64, maxEndpoints = 16 } = {}) {
    if (!validInteger(maxPipes, 1) || !validInteger(maxEndpoints, 1)) throw new TypeError('Invalid stream quotas');
    this.maxPipes = maxPipes;
    this.maxEndpoints = maxEndpoints;
    this.processes = new Map();
    this.pipes = new Set();
  }

  // Privileged boot-host operation; intentionally not a guest import.
  connect({ reader, writer, capacity = STREAM_MAX_COPY }) {
    if (!validInteger(capacity, 1) || capacity > STREAM_MAX_COPY) throw new TypeError('Invalid stream capacity');
    for (const endpoint of [reader, writer]) {
      if (!endpoint || !validInteger(endpoint.processId, 1) || !validInteger(endpoint.handle)) throw new TypeError('Invalid stream endpoint');
      const table = this.processes.get(endpoint.processId);
      if (table?.has(endpoint.handle)) throw new Error('Stream handle already bound');
      const needed = reader.processId === writer.processId ? 2 : 1;
      if ((table?.size ?? 0) + needed > this.maxEndpoints) throw new Error('Stream endpoint quota exceeded');
    }
    if (reader.processId === writer.processId && reader.handle === writer.handle) throw new Error('Stream endpoints must differ');
    if (this.pipes.size >= this.maxPipes) throw new Error('Stream pipe quota exceeded');
    const pipe = { bytes: new Uint8Array(capacity), head: 0, count: 0,
      readerOpen: true, writerOpen: true, readers: 1, writers: 1 };
    this.pipes.add(pipe);
    for (const [binding, direction] of [[reader, 'read'], [writer, 'write']]) {
      let table = this.processes.get(binding.processId);
      if (!table) { table = new Map(); this.processes.set(binding.processId, table); }
      table.set(binding.handle, { pipe, direction });
    }
  }

  endpoint(processId, handle) {
    if (!validInteger(processId, 1) || !validInteger(handle)) return null;
    return this.processes.get(processId)?.get(handle) ?? null;
  }

  // Host-only descriptor aliasing, e.g. stdout/stderr sharing one terminal.
  alias(processId, sourceHandle, targetHandle) {
    const endpoint = this.endpoint(processId, sourceHandle);
    if (!endpoint || !validInteger(targetHandle)) throw new TypeError('Invalid stream alias');
    const table = this.processes.get(processId);
    if (table.has(targetHandle)) throw new Error('Stream handle already bound');
    if (table.size >= this.maxEndpoints) throw new Error('Stream endpoint quota exceeded');
    table.set(targetHandle, endpoint);
    if (endpoint.direction === 'read') ++endpoint.pipe.readers;
    else ++endpoint.pipe.writers;
  }

  read(processId, handle, count) {
    const endpoint = this.endpoint(processId, handle);
    if (!endpoint) return STREAM_STATUS.INVALID_HANDLE;
    if (endpoint.direction !== 'read') return STREAM_STATUS.PERMISSION_DENIED;
    if (!validInteger(count) || count > STREAM_MAX_COPY) return STREAM_STATUS.INVALID_ARGUMENT;
    const pipe = endpoint.pipe;
    if (count === 0) return new Uint8Array(0);
    if (!pipe.count) return pipe.writerOpen ? STREAM_STATUS.WOULD_BLOCK : new Uint8Array(0);
    const length = Math.min(count, pipe.count);
    const bytes = new Uint8Array(length);
    const first = Math.min(length, pipe.bytes.length - pipe.head);
    bytes.set(pipe.bytes.subarray(pipe.head, pipe.head + first));
    bytes.set(pipe.bytes.subarray(0, length - first), first);
    pipe.head = (pipe.head + length) % pipe.bytes.length;
    pipe.count -= length;
    return bytes;
  }

  write(processId, handle, bytes) {
    const endpoint = this.endpoint(processId, handle);
    if (!endpoint) return STREAM_STATUS.INVALID_HANDLE;
    if (endpoint.direction !== 'write') return STREAM_STATUS.PERMISSION_DENIED;
    if (!(bytes instanceof Uint8Array) || bytes.length > STREAM_MAX_COPY) return STREAM_STATUS.INVALID_ARGUMENT;
    if (bytes.length === 0) return 0;
    const pipe = endpoint.pipe;
    if (!pipe.readerOpen) return STREAM_STATUS.CLOSED;
    const length = Math.min(bytes.length, pipe.bytes.length - pipe.count);
    if (!length) return STREAM_STATUS.WOULD_BLOCK;
    const tail = (pipe.head + pipe.count) % pipe.bytes.length;
    const first = Math.min(length, pipe.bytes.length - tail);
    pipe.bytes.set(bytes.subarray(0, first), tail);
    pipe.bytes.set(bytes.subarray(first, length), 0);
    pipe.count += length;
    return length;
  }

  close(processId, handle) {
    const endpoint = this.endpoint(processId, handle);
    if (!endpoint) return STREAM_STATUS.INVALID_HANDLE;
    const table = this.processes.get(processId);
    table.delete(handle);
    if (!table.size) this.processes.delete(processId);
    const pipe = endpoint.pipe;
    if (endpoint.direction === 'read') {
      pipe.readerOpen = --pipe.readers > 0;
      if (!pipe.readerOpen) pipe.count = 0;
    } else pipe.writerOpen = --pipe.writers > 0;
    if (!pipe.readerOpen && !pipe.writerOpen) this.pipes.delete(pipe);
    return STREAM_STATUS.OK;
  }

  closeProcess(processId) {
    for (const handle of [...(this.processes.get(processId)?.keys() ?? [])]) this.close(processId, handle);
  }

  get stats() {
    return Object.freeze({
      pipes: this.pipes.size,
      endpoints: [...this.processes.values()].reduce((sum, table) => sum + table.size, 0),
      capacityBytes: [...this.pipes].reduce((sum, pipe) => sum + pipe.bytes.length, 0),
      bufferedBytes: [...this.pipes].reduce((sum, pipe) => sum + pipe.count, 0),
    });
  }
}

export function bindShellStreams(broker, ioProcessId, shellProcessId) {
  if (!validInteger(ioProcessId, 1) || !validInteger(shellProcessId, 1) || ioProcessId === shellProcessId) throw new TypeError('Shell session requires distinct process identities');
  if (broker.processes.has(ioProcessId) || broker.processes.has(shellProcessId)) throw new Error('Shell session endpoints already bound');
  try {
    broker.connect({ reader: { processId: shellProcessId, handle: 0 }, writer: { processId: ioProcessId, handle: 3 } });
    broker.connect({ reader: { processId: ioProcessId, handle: 4 }, writer: { processId: shellProcessId, handle: 1 } });
    // Both output descriptors target the same terminal, preserving write order.
    broker.alias(shellProcessId, 1, 2);
    broker.alias(ioProcessId, 4, 5);
  } catch (error) {
    broker.closeProcess(ioProcessId); broker.closeProcess(shellProcessId); throw error;
  }
}
