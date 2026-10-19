import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { instantiateNativeWasm } from "../runtime/native-wasm.js";
import { instantiateNativeWasmUrl } from "../runtime/native-wasm-browser.js";
import { instantiateNativeWasmFile } from "../runtime/native-wasm-node.js";
import { createMaiaHostImports } from "../runtime/maia-host-imports.js";
import { MemoryVfsAdapter, VFS_FLAGS } from "../runtime/maia-vfs.js";

const addModule = Uint8Array.from([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 2, 127, 127, 1, 127, 3, 2, 1, 0, 7,
  7, 1, 3, 97, 100, 100, 0, 0, 10, 9, 1, 7, 0, 32, 0, 32, 1, 106, 11,
]);

test("native reference runtime instantiates and executes a module", async () => {
  const result = await instantiateNativeWasm(addModule);
  assert.equal(result.exports.add(20, 22), 42);
  assert.equal(result.backendId, "native-wasm-reference");
  assert.equal(result.isReferenceBackend, true);
});

test("Node wrapper loads a WASM module from disk", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "maiaos-native-wasm-"));
  const filePath = path.join(dir, "add.wasm");
  try {
    await writeFile(filePath, addModule);
    const result = await instantiateNativeWasmFile(filePath);
    assert.equal(result.host, "node");
    assert.equal(result.exports.add(19, 23), 42);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("browser wrapper fetches and instantiates a WASM module", async () => {
  let requestedUrl;
  const result = await instantiateNativeWasmUrl(
    "/apps/add.wasm",
    {},
    {
      fetch: async (url) => {
        requestedUrl = url;
        return { ok: true, arrayBuffer: async () => addModule.buffer };
      },
    },
  );
  assert.equal(requestedUrl, "/apps/add.wasm");
  assert.equal(result.host, "browser");
  assert.equal(result.exports.add(9, 33), 42);
});

test("browser wrapper propagates HTTP errors instead of substituting a runtime", async () => {
  await assert.rejects(
    instantiateNativeWasmUrl(
      "/apps/missing.wasm",
      {},
      {
        fetch: async () => ({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      },
    ),
    /WASM request failed \(404 Not Found\)/,
  );
});

test("native compile errors remain observable", async () => {
  await assert.rejects(
    instantiateNativeWasm(Uint8Array.from([0, 1, 2, 3])),
    WebAssembly.CompileError,
  );
});

test("Maia host imports forward callbacks and validate guest memory", () => {
  const calls = [];
  const host = createMaiaHostImports({
    vfs: new MemoryVfsAdapter(),
    graphics: {
      windowCreate: (title) => (calls.push(["window", title]), 11),
      labelCreate: (parent, label) => (
        calls.push(["label", parent, label]),
        12
      ),
      labelSetText: (handle, label) => (
        calls.push(["label-set-text", handle, label]),
        0
      ),
      buttonCreate: (parent, label) => (
        calls.push(["button", parent, label]),
        13
      ),
      objectDestroy: (handle) => (calls.push(["destroy", handle]), 0),
    },
    log: (level, text) => calls.push(["log", level, text]),
    monotonicMs: () => 1234,
    onProcessExit: (exitCode) => calls.push(["exit", exitCode]),
  });
  const memory = new WebAssembly.Memory({ initial: 1 });
  const message = new TextEncoder().encode("Callback-owned UI");
  new Uint8Array(memory.buffer, 64, message.length).set(message);
  host.attachMemory(memory);

  assert.equal(host.imports["maia.gfx"].window_create(64, message.length), 11);
  assert.deepEqual(calls[0], ["window", "Callback-owned UI"]);
  assert.equal(
    host.imports["maia.gfx"].label_create(11, 64, message.length),
    12,
  );
  assert.equal(
    host.imports["maia.gfx"].label_set_text(12, 64, message.length),
    0,
  );
  assert.equal(host.imports["maia.time"].monotonic_ms(), 1234n);
  host.imports["maia.process"].exit(0);
  assert.deepEqual(calls.at(-1), ["exit", 0]);
  assert.throws(
    () => host.imports["maia.gfx"].window_create(65530, 64),
    RangeError,
  );

  const pathBytes = new TextEncoder().encode("/system/welcome.txt");
  new Uint8Array(memory.buffer, 256, pathBytes.length).set(pathBytes);
  const fileHandle = host.imports["maia.vfs"].open(
    256,
    pathBytes.length,
    VFS_FLAGS.READ,
  );
  assert.ok(fileHandle > 0);
  const bytesRead = host.imports["maia.vfs"].read(fileHandle, 512, 128);
  assert.ok(bytesRead > 0);
  assert.match(
    new TextDecoder().decode(new Uint8Array(memory.buffer, 512, bytesRead)),
    /C\+\+ kernel read this text through maia.vfs/,
  );
  assert.equal(host.imports["maia.vfs"].close(fileHandle), 0);
  assert.equal(
    host.imports["maia.vfs"].read(fileHandle, 512, 8),
    host.status.INVALID_HANDLE,
  );

  const queueHost = createMaiaHostImports({
    vfs: new MemoryVfsAdapter(),
    graphics: {
      windowCreate: () => 1,
      labelCreate: () => 2,
      labelSetText: () => 0,
      buttonCreate: () => 3,
      objectDestroy: () => 0,
    },
  });
  queueHost.attachMemory(memory);
  assert.equal(
    queueHost.imports["maia.events"].poll(128, 24),
    queueHost.status.WOULD_BLOCK,
  );
  assert.equal(
    queueHost.enqueueEvent({ type: 1, objectHandle: 13 }),
    queueHost.status.OK,
  );
  assert.equal(
    queueHost.imports["maia.events"].poll(128, 23),
    queueHost.status.INVALID_ARGUMENT,
  );
  assert.equal(queueHost.queuedEventCount, 1);
  assert.equal(queueHost.imports["maia.events"].poll(128, 24), 24);
  const packet = new DataView(memory.buffer, 128, 24);
  assert.deepEqual(
    [0, 4, 8, 12, 16, 20].map((offset) => packet.getUint32(offset, true)),
    [1, 1, 13, 0, 0, 0],
  );

  for (let event = 0; event < 64; event += 1) {
    assert.equal(
      queueHost.enqueueEvent({ type: 1, objectHandle: event + 1 }),
      queueHost.status.OK,
    );
  }
  assert.equal(
    queueHost.enqueueEvent({ type: 1, objectHandle: 65 }),
    queueHost.status.WOULD_BLOCK,
  );
  assert.equal(queueHost.queuedEventCount, 64);
});

test("Maia TTY imports poll UTF-8 lines and write bounded output", () => {
  const lines = ["echo olá"];
  const output = [];
  const host = createMaiaHostImports({
    vfs: new MemoryVfsAdapter(),
    graphics: {
      windowCreate: () => 1,
      labelCreate: () => 2,
      labelSetText: () => 0,
      buttonCreate: () => 3,
      objectDestroy: () => 0,
    },
    tty: {
      pollLine: () => lines.shift() ?? null,
      write: (stream, text) => output.push([stream, text]),
    },
  });
  const memory = new WebAssembly.Memory({ initial: 1 });
  host.attachMemory(memory);

  assert.equal(
    host.imports["maia.tty"].poll_line(256, 32),
    new TextEncoder().encode("echo olá").byteLength,
  );
  assert.equal(
    new TextDecoder().decode(new Uint8Array(memory.buffer, 256, 9)),
    "echo olá",
  );
  assert.equal(
    host.imports["maia.tty"].poll_line(256, 32),
    host.status.WOULD_BLOCK,
  );

  const message = new TextEncoder().encode("linha de saída\n");
  new Uint8Array(memory.buffer, 512, message.length).set(message);
  assert.equal(
    host.imports["maia.tty"].write(1, 512, message.length),
    message.length,
  );
  assert.deepEqual(output, [[1, "linha de saída\n"]]);
  assert.equal(
    host.imports["maia.tty"].write(1, 65530, 32),
    host.status.INVALID_ARGUMENT,
  );
});
