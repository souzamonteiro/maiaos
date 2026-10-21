import assert from 'node:assert/strict';
import test from 'node:test';
import { MaiaStreamBroker, bindShellStreams, STREAM_STATUS as S } from '../runtime/maia-streams.js';
import { createMaiaHostImports } from '../runtime/maia-host-imports.js';
import { MemoryVfsAdapter } from '../runtime/maia-vfs.js';

function pipe(capacity = 4) {
  const broker = new MaiaStreamBroker();
  broker.connect({ reader: { processId: 3, handle: 0 }, writer: { processId: 2, handle: 3 }, capacity });
  return broker;
}
const bytes = values => new Uint8Array(values);

test('shell stdout/stderr preserve terminal write order and alias lifecycle', () => {
  const b = new MaiaStreamBroker(); bindShellStreams(b, 2, 3);
  b.write(3, 1, bytes([1])); b.write(3, 2, bytes([2])); b.write(3, 1, bytes([3]));
  assert.deepEqual(b.read(2, 4, 4), bytes([1, 2, 3]));
  b.close(3, 1); assert.equal(b.read(2, 5, 1), S.WOULD_BLOCK);
  b.write(3, 2, bytes([4])); b.close(2, 4);
  assert.deepEqual(b.read(2, 5, 1), bytes([4]));
  b.closeProcess(3); assert.deepEqual(b.read(2, 5, 1), bytes([]));
  b.closeProcess(2); assert.equal(b.stats.pipes, 0);
});

test('bounded streams preserve partial writes, FIFO wrap and backpressure', () => {
  const b = pipe();
  assert.equal(b.read(3, 0, 1), S.WOULD_BLOCK);
  assert.equal(b.write(2, 3, bytes([1, 2, 3, 4, 5])), 4);
  assert.equal(b.write(2, 3, bytes([6])), S.WOULD_BLOCK);
  assert.deepEqual(b.read(3, 0, 3), bytes([1, 2, 3]));
  assert.equal(b.write(2, 3, bytes([5, 6, 7, 8])), 3);
  assert.deepEqual(b.read(3, 0, 4), bytes([4, 5, 6, 7]));
  assert.equal(b.stats.bufferedBytes, 0);
  assert.equal(b.stats.capacityBytes, 4);
});

test('stream identity, direction, copy limits and zero-length operations', () => {
  const b = pipe();
  assert.equal(b.read(99, 0, 1), S.INVALID_HANDLE);
  assert.equal(b.write(3, 3, bytes([1])), S.INVALID_HANDLE);
  assert.equal(b.read(2, 3, 1), S.PERMISSION_DENIED);
  assert.equal(b.write(3, 0, bytes([1])), S.PERMISSION_DENIED);
  for (const count of [-1, 0.5, 4097, Infinity]) assert.equal(b.read(3, 0, count), S.INVALID_ARGUMENT);
  assert.equal(b.write(2, 3, new Uint8Array(4097)), S.INVALID_ARGUMENT);
  assert.equal(b.write(2, 3, [1]), S.INVALID_ARGUMENT);
  assert.equal(b.write(2, 3, bytes([])), 0);
  assert.deepEqual(b.read(3, 0, 0), bytes([]));
  const input = bytes([42]);
  assert.equal(b.write(2, 3, input), 1); input[0] = 99;
  assert.deepEqual(b.read(3, 0, 1), bytes([42]), 'writes copy bytes, not shared references');
});

test('writer closure drains bytes before EOF; reader closure reports CLOSED', () => {
  const b = pipe();
  b.write(2, 3, bytes([1, 2]));
  assert.equal(b.close(2, 3), 0);
  assert.equal(b.close(2, 3), S.INVALID_HANDLE);
  assert.deepEqual(b.read(3, 0, 3), bytes([1, 2]));
  assert.deepEqual(b.read(3, 0, 3), bytes([]));
  b.close(3, 0); assert.deepEqual(b.stats, { pipes: 0, endpoints: 0, capacityBytes: 0, bufferedBytes: 0 });
  const other = pipe(); other.closeProcess(3);
  assert.equal(other.write(2, 3, bytes([1])), S.CLOSED);
  other.closeProcess(2); other.closeProcess(2); assert.equal(other.stats.pipes, 0);
});

test('stream quota failures are atomic and endpoint allocations are reusable', () => {
  const b = new MaiaStreamBroker({ maxPipes: 1, maxEndpoints: 1 });
  b.connect({ reader: { processId: 3, handle: 0 }, writer: { processId: 2, handle: 3 } });
  const before = b.stats;
  assert.throws(() => b.connect({ reader: { processId: 4, handle: 0 }, writer: { processId: 2, handle: 4 } }), /quota/);
  assert.deepEqual(b.stats, before);
  assert.throws(() => b.connect({ reader: { processId: 3, handle: 0 }, writer: { processId: 5, handle: 0 } }), /already bound/);
  b.closeProcess(2); b.closeProcess(3);
  for (let i = 0; i < 1000; ++i) {
    b.connect({ reader: { processId: 3, handle: 0 }, writer: { processId: 2, handle: 3 } });
    b.write(2, 3, bytes([i & 255])); assert.deepEqual(b.read(3, 0, 1), bytes([i & 255]));
    b.closeProcess(2); b.closeProcess(3);
  }
  assert.equal(b.stats.pipes, 0); assert.equal(b.processes.size, 0);
});

test('guest stream imports validate complete ranges before consuming bytes', () => {
  const broker = pipe();
  const unused = () => { throw new Error('Unexpected graphics'); };
  const host = createMaiaHostImports({
    graphics: Object.fromEntries(['windowCreate', 'labelCreate', 'labelSetText', 'buttonCreate', 'objectDestroy'].map(n => [n, unused])),
    vfs: new MemoryVfsAdapter(), streams: broker, processId: 3,
  });
  const memory = new WebAssembly.Memory({ initial: 1 }); host.attachMemory(memory);
  const stream = host.imports['maia.stream'];
  broker.write(2, 3, bytes([10, 20]));
  for (const [pointer, length] of [[65535, 2], [-1, 1], [0, 4097], [0, -1]]) {
    assert.equal(stream.read(0, pointer, length), S.INVALID_ARGUMENT);
    assert.equal(stream.write(0, pointer, length), S.INVALID_ARGUMENT);
    assert.equal(broker.stats.bufferedBytes, 2);
  }
  const view = new Uint8Array(memory.buffer); view.fill(0xcc, 127, 132);
  assert.equal(stream.read(0, 128, 2), 2);
  assert.deepEqual(view.slice(127, 132), bytes([0xcc, 10, 20, 0xcc, 0xcc]));
  memory.grow(1); broker.write(2, 3, bytes([30]));
  assert.equal(stream.read(0, 70000, 1), 1);
  assert.equal(new Uint8Array(memory.buffer)[70000], 30);
  host.imports['maia.process'].exit(0);
  assert.equal(broker.write(2, 3, bytes([40])), S.CLOSED);
  host.closeStreams();
});

test('shell boot bindings reject shared identities and roll back quota failures', () => {
  const b = new MaiaStreamBroker();
  for (const [io, shell] of [[2, 2], [0, 3], [2, -1]]) {
    assert.throws(() => bindShellStreams(b, io, shell), /distinct process identities/);
    assert.equal(b.stats.endpoints, 0);
  }
  const limited = new MaiaStreamBroker({maxEndpoints: 2});
  assert.throws(() => bindShellStreams(limited, 2, 3), /quota/);
  assert.deepEqual(limited.stats, {pipes: 0, endpoints: 0, capacityBytes: 0, bufferedBytes: 0});
  bindShellStreams(b, 2, 3);
  const before = b.stats;
  assert.throws(() => bindShellStreams(b, 2, 3), /already bound/);
  assert.deepEqual(b.stats, before, 'failed duplicate boot must preserve the live session');
});
