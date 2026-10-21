import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMaiaHostImports, MAIA_EVENT_KEY, MAIA_KEY_TEXT, MAIA_KEY_ENTER } from "../runtime/maia-host-imports.js";
import { MaiaStreamBroker, bindShellStreams } from "../runtime/maia-streams.js";
import { MemoryVfsAdapter } from "../runtime/maia-vfs.js";
import { assertManifestCapabilities } from "../runtime/maia-capabilities.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", {fatal: true});
const modules = {};
const manifests = {};
for (const name of ["io", "shell"]) {
  modules[name] = await WebAssembly.compile(await readFile(new URL(`../apps/${name}/${name}.wasm`, import.meta.url)));
  manifests[name] = JSON.parse(await readFile(new URL(`../apps/${name}/manifest.json`, import.meta.url), "utf8"));
  assertManifestCapabilities(modules[name], manifests[name], manifests[name].capabilities);
}
function ports(broker, capacity = 4096) {
  broker.connect({reader: {processId: 3, handle: 0}, writer: {processId: 2, handle: 3}, capacity});
  broker.connect({reader: {processId: 2, handle: 4}, writer: {processId: 3, handle: 1}, capacity});
  broker.alias(3, 1, 2); broker.alias(2, 4, 5);
}
async function guest(name, broker, vfs = new MemoryVfsAdapter({appId: manifests[name].id})) {
  const labels = new Map(); let nextHandle = 1; let exit = null;
  const host = createMaiaHostImports({streams: broker, processId: name === "io" ? 2 : 3, vfs,
    graphics: {windowCreate: () => nextHandle++, labelCreate: (_parent, text) => {
      const handle = nextHandle++; labels.set(handle, text); return handle;
    }, labelSetText: (handle, text) => { labels.set(handle, text); return 0; },
    buttonCreate: () => -1, objectDestroy: () => 0},
    onProcessExit: code => { exit = code; },
  });
  const instance = await WebAssembly.instantiate(modules[name], host.imports);
  host.attachInstance(instance);
  instance.exports[manifests[name].entryExport]();
  const stack = instance.exports.__stack_ptr.value;
  const pages = instance.exports.memory.buffer.byteLength;
  return {host, labels, instance, get exit() {return exit;},
    step() { if (exit === null) instance.exports.maiaos_step(); },
    stable() {assert.equal(instance.exports.__stack_ptr.value, stack); assert.equal(instance.exports.memory.buffer.byteLength, pages);},
    display() {return [...labels.values()].join("");},
  };
}
const empty = broker => assert.deepEqual(broker.stats, {pipes: 0, endpoints: 0, capacityBytes: 0, bufferedBytes: 0});
// Feed byte fragments to the actual I/O guest: this fixture transports output only.
{
  const broker = new MaiaStreamBroker(); ports(broker);
  const io = await guest("io", broker);
  for (const byte of encoder.encode("Olá 🌎\nmaia> ")) {
    assert.equal(broker.write(3, 1, Uint8Array.of(byte)), 1); io.step();
  }
  assert.equal(io.display(), "Olá 🌎\nmaia> |");
  for (const byte of encoder.encode("\x1b[2J\x1b[H")) {broker.write(3, 1, Uint8Array.of(byte)); io.step();}
  assert.equal(io.display(), "|");
  broker.write(3, 2, Uint8Array.of(0xff, 0xe2)); io.step();
  assert.equal(io.display(), "�|");
  // Once output is closed, pending keys must not turn normal EOF into a write error.
  io.host.enqueueEvent({type: MAIA_EVENT_KEY, objectHandle: 0, data1: MAIA_KEY_ENTER});
  broker.closeProcess(3); io.step();
  assert.equal(io.display(), "��|"); assert.equal(io.exit, 0); io.stable(); empty(broker);
}
// Long unterminated UTF-8 output plus a full editable line stays in display bounds.
{
  const broker = new MaiaStreamBroker(); ports(broker);
  const io = await guest("io", broker);
  const bytes = encoder.encode("á".repeat(2000));
  assert.equal(broker.write(3, 1, bytes), bytes.length); io.step();
  for (let key = 0; key < 255; ++key) {
    io.host.enqueueEvent({type: MAIA_EVENT_KEY, objectHandle: 0, data0: 120, data1: MAIA_KEY_TEXT}); io.step();
  }
  assert.ok(encoder.encode(io.display()).length <= 4095);
  assert.ok(io.display().endsWith("x".repeat(255) + "|"));
  assert.ok(!io.display().includes("�")); io.stable();
  broker.closeProcess(3); io.step(); assert.equal(io.exit, 0); empty(broker);
}
// Slow stdin consumer: retain one canonical line and leave subsequent keys queued.
{
  const broker = new MaiaStreamBroker(); ports(broker, 7);
  const io = await guest("io", broker);
  for (const source of ["echo slow", "pwd"]) {
    for (const character of source) assert.equal(io.host.enqueueEvent({type: MAIA_EVENT_KEY, objectHandle: 0, data0: character.charCodeAt(0), data1: MAIA_KEY_TEXT}), 0);
    assert.equal(io.host.enqueueEvent({type: MAIA_EVENT_KEY, objectHandle: 0, data1: MAIA_KEY_ENTER}), 0);
  }
  io.step(); io.step();
  let input = "";
  for (let tick = 0; tick < 50; ++tick) {
    const bytes = broker.read(3, 0, 1); if (bytes instanceof Uint8Array) input += decoder.decode(bytes);
    io.step();
  }
  assert.equal(input, "echo slow\npwd\n"); io.stable();
  broker.closeProcess(3); io.step(); assert.equal(io.exit, 0); empty(broker);
}
// Broken stdin peer must terminate the I/O guest and release its output handles.
{
  const broker = new MaiaStreamBroker(); ports(broker);
  const io = await guest("io", broker); broker.close(3, 0);
  io.host.enqueueEvent({type: MAIA_EVENT_KEY, objectHandle: 0, data1: MAIA_KEY_ENTER}); io.step();
  assert.equal(io.exit, 1); broker.closeProcess(3); empty(broker);
}
// Shell writes to a tiny ring: a large VFS read must resume without loss/deadlock.
{
  const broker = new MaiaStreamBroker(); ports(broker, 31);
  const contents = "Maia streamed data 0123456789\n".repeat(600);
  const vfs = new MemoryVfsAdapter({appId: manifests.shell.id, files: {"/system/welcome.txt": contents}});
  const shell = await guest("shell", broker, vfs);
  let output = "";
  function drain() {const bytes = broker.read(2, 4, 11); if (bytes instanceof Uint8Array) output += decoder.decode(bytes);}
  for (let tick = 0; tick < 12; ++tick) {drain(); shell.step();}
  output = "";
  const command = encoder.encode("cat /system/welcome.txt\n"); assert.equal(broker.write(2, 3, command), command.length);
  for (let tick = 0; tick < 20; ++tick) shell.step();
  assert.equal(broker.stats.bufferedBytes, 31, "Full output ring applies backpressure");
  assert.equal(shell.exit, null);
  for (let tick = 0; tick < 5000 && !output.endsWith("maia> "); ++tick) {drain(); shell.step();}
  // Drain the final output already copied into the transport.
  for (let tick = 0; tick < 8; ++tick) {drain(); shell.step();}
  assert.equal(output, contents + "maia> "); assert.equal(vfs.handles.size, 0); shell.stable();
  // EOF executes a final unterminated command and exits after stdout is drained.
  broker.write(2, 3, encoder.encode("echo final")); broker.close(2, 3); output = "";
  for (let tick = 0; tick < 30; ++tick) {drain(); shell.step();}
  assert.equal(output, "final\n"); assert.equal(shell.exit, 0); shell.stable();
  broker.closeProcess(2); empty(broker);
}
// Oversized canonical input is rejected once; the following command still works.
{
  const broker = new MaiaStreamBroker(); ports(broker);
  const shell = await guest("shell", broker);
  broker.read(2, 4, 4096);
  broker.write(2, 3, encoder.encode("x".repeat(300) + "\necho recovered\n")); shell.step();
  assert.equal(decoder.decode(broker.read(2, 4, 4096)), "shell input limit exceeded\nmaia> recovered\nmaia> ");
  broker.write(2, 3, encoder.encode("echo closed\n"));
  broker.closeProcess(2); shell.step(); assert.equal(shell.exit, 1); empty(broker);
}
// Reuse the same broker with fresh actual guests: no endpoints survive a session.
{
  const broker = new MaiaStreamBroker();
  for (let session = 0; session < 25; ++session) {
    bindShellStreams(broker, 2, 3);
    const io = await guest("io", broker); const shell = await guest("shell", broker);
    io.step();
    for (const character of "exit") io.host.enqueueEvent({type: MAIA_EVENT_KEY, objectHandle: 0, data0: character.charCodeAt(0), data1: MAIA_KEY_TEXT});
    io.host.enqueueEvent({type: MAIA_EVENT_KEY, objectHandle: 0, data1: MAIA_KEY_ENTER});
    for (let tick = 0; tick < 6; ++tick) {io.step(); shell.step();}
    assert.equal(shell.exit, 0); assert.equal(io.exit, 0); io.stable(); shell.stable(); empty(broker);
  }
}
console.log("Actual I/O/shell WASM stream tests passed: fragmented UTF-8/clear, canonical-input backpressure, closed peers, large VFS cat through a 31-byte ring, EOF, input recovery and 25 clean relaunches.");
