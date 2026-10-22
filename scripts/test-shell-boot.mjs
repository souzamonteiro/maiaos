// Exercise the actual browser boot/lifecycle functions in a Node reference host.
// No DOM rendering or browser-interaction claim is made by this harness.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createMaiaHostImports, MAIA_EVENT_KEY, MAIA_KEY_ENTER, MAIA_KEY_TEXT } from "../runtime/maia-host-imports.js";
import { instantiateNativeWasm } from "../runtime/native-wasm.js";
import { assertManifestCapabilities } from "../runtime/maia-capabilities.js";
import { MaiaStreamBroker } from "../runtime/maia-streams.js";
import { KernelProcessController } from "../runtime/maia-kernel-processes.js";
import { KernelPipelineTransport } from "../runtime/maia-pipeline-transport.js";
import { MaiaVfsStore } from "../runtime/maia-vfs-store.js";
import { MemoryVfsAdapter } from "../runtime/maia-vfs.js";
import { createLvglGraphicsCallbacks } from "../platform/desktop-web/lvgl-bridge.js";
import createLvgl from "../platform/desktop-web/generated/maiaos-lvgl.js";

let flushes = 0;
const lvgl = await createLvgl({noInitialRun: true, onLvglFlush: () => ++flushes}); lvgl._main();
const real = createLvglGraphicsCallbacks(lvgl);
const liveWindows = new Set();
const graphicsCallbacks = {...real,
  windowCreate(title) { const handle = real.windowCreate(title); if (handle > 0) liveWindows.add(handle); return handle; },
  objectDestroy(handle) {const result = real.objectDestroy(handle); if (result === 0) liveWindows.delete(handle); return result;},
};
const source = await readFile(new URL("../platform/desktop-web/main.js", import.meta.url), "utf8");
const broker = new MaiaStreamBroker();
const runningProcesses = new Set();
const ioManifest = JSON.parse(await readFile(new URL("../apps/io/manifest.json", import.meta.url), "utf8"));
const shellManifest = JSON.parse(await readFile(new URL("../apps/shell/manifest.json", import.meta.url), "utf8"));
const ioBytes = await readFile(new URL("../apps/io/io.wasm", import.meta.url));
const shellBytes = await readFile(new URL("../apps/shell/shell.wasm", import.meta.url));
const kernelManifest=JSON.parse(await readFile(new URL("../apps/kernel/kernel.json",import.meta.url),"utf8"));
const kernelBytes=await readFile(new URL("../platform/desktop-web/generated/kernel.wasm",import.meta.url));
let failIo = false;
const adapters = [];
const context = vm.createContext({
  WebAssembly, URL, Uint8Array, Number, TypeError, RangeError, Error, console,
  sharedVfsStore: new MaiaVfsStore(),
  kernelController:null, pipelineTransport:null, kernelProcess:null, catPackage:null,
  KernelProcessController, KernelPipelineTransport,
  runningProcesses, buttonOwners: new Map(), streamBroker: broker,
  graphicsCallbacks, createMaiaHostImports, instantiateNativeWasm, assertManifestCapabilities,
  BROWSER_HOST_GRANTS: [...new Set([...ioManifest.capabilities, ...shellManifest.capabilities,...kernelManifest.capabilities,"process.args"])],
  window: {location: {href: "http://localhost:8080/"}},
  document: {getElementById: () => ({textContent: ""})},
  // Storage callback fixture: actual boot code applies limits and owns lifecycle.
  IndexedDbVfsAdapter: {create: async options => {
    const adapter = new MemoryVfsAdapter(options); adapters.push(adapter); return adapter;
  }},
  MemoryVfsAdapter, status: {textContent: ""},
  fetch: async url => ({ok: true,
    json: async () => failIo ? {...ioManifest, entryExport: "missing_entry"} : ioManifest,
    arrayBuffer: async () => ioBytes,
  }),
});
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
vm.runInContext(extract("function processGraphics(", "function routeLvglEvent(")
  + extract("function stopProcess(", "async function createAppVfs(")
  + extract("async function createAppVfs(", "async function launchSelectedApp("), context);
const options = {manifest: shellManifest, bytes: shellBytes,
  entryName: shellManifest.entryExport, stepName: shellManifest.stepExport};
const core=await context.startProcess({manifest:kernelManifest,bytes:kernelBytes,role:"kernel",entryName:kernelManifest.entryExport,stepName:kernelManifest.stepExport});
context.kernelProcess=core;
// Session teardown leaves the intentionally persistent, real kernel running.
const empty = () => {assert.equal(runningProcesses.size, 1);assert.ok(runningProcesses.has(core));assert.ok(core.running);assert.equal(liveWindows.size, 1);
  assert.equal(broker.stats.pipes, 0); assert.equal(broker.stats.endpoints, 0);
  assert.ok(adapters.every(adapter => adapter.openHandleCount === 0));};
await assert.rejects(context.startApplication({...options, bytes: new Uint8Array([0])}), /WebAssembly/); empty();
await assert.rejects(context.startApplication({...options, entryName: "missing_shell_entry"}), /missing_shell_entry/); empty();
failIo = true;
await assert.rejects(context.startApplication(options), /missing_entry/); empty(); failIo = false;
for (let session = 0; session < 25; ++session) {
  const shell = await context.startApplication(options);
  const io = [...runningProcesses].find(process => process.role === "service");
  assert.ok(io.acceptsKeyboardInput); assert.equal(shell.acceptsKeyboardInput, false);
  assert.equal(io.vfs.maxOpenFiles, 0); assert.equal(shell.vfs.maxOpenFiles, 4);
  assert.equal(runningProcesses.size, 3); assert.equal(liveWindows.size, 2);
  for (const character of "exit") io.host.enqueueEvent({type: MAIA_EVENT_KEY, objectHandle: 0, data0: character.charCodeAt(0), data1: MAIA_KEY_TEXT});
  io.host.enqueueEvent({type: MAIA_EVENT_KEY, objectHandle: 0, data1: MAIA_KEY_ENTER});
  for (let tick = 0; tick < 12; ++tick) {
    lvgl._maiaos_lvgl_tick();
    context.stepKernelProcesses();
  }
  empty();
}
// A real guest import trap while ls owns a directory must release that handle.
{
  const process = await context.startApplication(options);
  const io = [...runningProcesses].find(item => item.role === "service");
  process.vfs.readdir = () => { throw new Error("Injected directory transport trap"); };
  broker.write(io.pid, 3, new TextEncoder().encode("ls /system\n"));
  assert.throws(() => process.runtime.exports.maiaos_step(), /directory transport trap/);
  assert.equal(process.vfs.openHandleCount, 1);
  context.stopProcess(process, 1);
  assert.equal(process.vfs.openHandleCount, 0);
  for (let tick = 0; tick < 12; ++tick) {
    lvgl._maiaos_lvgl_tick();
    context.stepKernelProcesses();
  }
  empty();
}
// A real cat read trap must release its file and the terminal session.
{
  const process = await context.startApplication(options);
  const io = [...runningProcesses].find(item => item.role === "service");
  process.vfs.files.set("/shared/read-trap.txt", new TextEncoder().encode("fixture"));
  process.vfs.read = () => { throw new Error("Injected file transport trap"); };
  broker.write(io.pid, 3, new TextEncoder().encode("cat /shared/read-trap.txt\n"));
  assert.throws(() => process.runtime.exports.maiaos_step(), /file transport trap/);
  assert.equal(process.vfs.openHandleCount, 1);
  context.stopProcess(process, 1); assert.equal(process.vfs.openHandleCount, 0);
  for (let tick = 0; tick < 12; ++tick) {
    lvgl._maiaos_lvgl_tick();
    context.stepKernelProcesses();
  }
  empty();
}
// Redirection adds a second owned file; host trap cleanup releases both.
{
  const process = await context.startApplication(options);
  const io = [...runningProcesses].find(item => item.role === "service");
  process.vfs.files.set("/shared/write-trap-input", new TextEncoder().encode("fixture"));
  process.vfs.write = () => { throw new Error("Injected output transport trap"); };
  broker.write(io.pid, 3, new TextEncoder().encode("cat /shared/write-trap-input > /tmp/trap-output\n"));
  assert.throws(() => process.runtime.exports.maiaos_step(), /output transport trap/);
  assert.equal(process.vfs.openHandleCount, 2);
  context.stopProcess(process, 1); assert.equal(process.vfs.openHandleCount, 0);
  for (let tick = 0; tick < 12; ++tick) {
    lvgl._maiaos_lvgl_tick();
    context.stepKernelProcesses();
  }
  empty();
}
assert.equal((await context.createAppVfs("limit.test", 100)).maxOpenFiles, 16);
await assert.rejects(context.createAppVfs("limit.test", -1), /Invalid open-file limit/);
await assert.rejects(context.createAppVfs("limit.test", 1.5), /Invalid open-file limit/);
assert.equal(context.window.location.href, "http://localhost:8080/");
context.stopProcess(core,0);assert.equal(runningProcesses.size,0);assert.equal(liveWindows.size,0);
assert.ok(flushes > 0);
console.log(`Actual boot functions passed: failed I/O/shell startup cleanup, keyboard ownership, 25 real LVGL session launches/exits, directory/file-trap cleanup, manifest quotas, unchanged URL, zero surviving windows/endpoints (${flushes} flushes).`);
