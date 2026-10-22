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
const labels=new Map(),terminalLabels=[];let terminalWindow=0;
const graphicsCallbacks = {...real,
  windowCreate(title) { const handle = real.windowCreate(title); if(title==="Maia Terminal")terminalWindow=handle; if (handle > 0) liveWindows.add(handle); return handle; },
  labelCreate(parent,text){const h=real.labelCreate(parent,text);labels.set(h,text);if(parent===terminalWindow)terminalLabels.push(h);return h;},
  labelSetText(handle,text){labels.set(handle,text);return real.labelSetText(handle,text);},
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
const catManifest=JSON.parse(await readFile(new URL("../apps/cat/manifest.json",import.meta.url),"utf8"));
const catBytes=await readFile(new URL("../apps/cat/cat.wasm",import.meta.url));
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
    json: async () => String(url).includes("/apps/cat/") ? catManifest : ioManifest,
    arrayBuffer: async () => String(url).includes("/apps/cat/") ? catBytes : ioBytes,
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
context.pipelineTransport.pipeCapacity=31;
const shellProcess=await context.startApplication(options);
const ioProcess=[...runningProcesses].find(p=>p.role==='service');
const out=terminalLabels[0],input=terminalLabels[1];assert.ok(out&&input);
const text=s=>new TextEncoder().encode(s);
shellProcess.vfs.files.set('/shared/pipeline-a',text('A\n'));
shellProcess.vfs.files.set('/shared/pipeline-b',text('B\n'));
shellProcess.vfs.files.set('/home/'+shellManifest.id+'/private',text('OWN\n'));
shellProcess.vfs.files.set('/home/another/private',text('NEVER'));
shellProcess.vfs.files.set('/shared/semi;literal',text('LITERAL\n'));
async function tick(){lvgl._maiaos_lvgl_tick();context.stepKernelProcesses();await context.pipelineTransport.pump();}
async function submit(source){for(const char of source){ioProcess.host.enqueueEvent({type:MAIA_EVENT_KEY,objectHandle:0,data0:char.codePointAt(0),data1:MAIA_KEY_TEXT});await tick();}
 ioProcess.host.enqueueEvent({type:MAIA_EVENT_KEY,objectHandle:0,data1:MAIA_KEY_ENTER});
 for(let i=0;i<10000;++i){await tick();if(source==='exit'&&!shellProcess.running)return;if(labels.get(input)==='maia> |' && broker.stats.bufferedBytes===0 && ![...runningProcesses].some(p=>p.role==='worker'))return;}
 throw new Error('Real shell pipeline failed to return its prompt: '+labels.get(out)+' / '+labels.get(input));
}
for(let i=0;i<5;++i)await tick();
const cases=[
 ['cat /shared/pipeline-a | cat','A\n'],
 ['cat /shared/pipeline-b /shared/pipeline-a | cat | cat | cat','B\nA\n'],
 ['cat /shared/pipeline-[ab] | cat','A\nB\n'],
 ['cat "/shared/semi;literal" | cat','LITERAL\n'],
 ['cd /shared',''],['cat pipeline-a | cat','A\n'],
 ['cd',''],['cat private | cat','OWN\n'],
 ['echo unsupported | cat','shell: unsupported pipeline command\n'],
 ['cat private | cat > /tmp/never','unsupported syntax: simple commands only\n'],
 ['cat private | cat | cat | cat | cat','unsupported syntax: simple commands only\n'],
 ['echo okay > /tmp/redirect',''],['cat /tmp/redirect','okay\n'],
];
for(const [source,expected] of cases){await submit('clear');await submit(source);assert.equal(labels.get(out),`maia> ${source}\n${expected}`,source);assert.equal(runningProcesses.size,3);assert.equal(liveWindows.size,2);assert.equal(shellProcess.vfs.openHandleCount,0);}
catManifest.capabilities.push('vfs.write');
await submit('clear');await submit('cat /shared/pipeline-a | cat');
assert.equal(labels.get(out),'maia> cat /shared/pipeline-a | cat\nshell: pipeline failed\n');
catManifest.capabilities.pop();
for(let i=0;i<25;i++){await submit('clear');await submit('cat /shared/pipeline-a | cat');assert.equal(labels.get(out),'maia> cat /shared/pipeline-a | cat\nA\n');}
assert.equal(shellProcess.vfs.files.has('/tmp/never'),false);
await submit('exit');for(let i=0;i<10;i++)await tick();assert.equal(runningProcesses.size,1);assert.ok(core.running);assert.equal(broker.stats.pipes,0);assert.equal(broker.stats.endpoints,0);
// Platform shutdown of a trapped kernel must not leave app/worker instances.
const again=await context.startApplication(options),againIo=[...runningProcesses].find(p=>p.role==='service');
again.vfs.files.set('/shared/shutdown-input',text('x'.repeat(4096)));
broker.write(againIo.pid,3,text('cat /shared/shutdown-input | cat\n'));
context.stepKernelProcesses();const pendingTransport=context.pipelineTransport;
context.stopProcess(core,1,true);await pendingTransport.pump();
assert.equal(runningProcesses.size,0);assert.equal(liveWindows.size,0);assert.equal(broker.stats.pipes,0);assert.equal(broker.stats.endpoints,0);assert.equal(pendingTransport.owners.size,0);assert.ok(adapters.every(adapter=>adapter.openHandleCount===0));
console.log(`PASS actual browser boot functions/kernel scheduler/shell generated AST/MaiaGlob/cat workers/I/O/LVGL pipelines (${flushes} flushes), private delegation, unsupported-form atomicity, repeat/reap and existing redirection`);
