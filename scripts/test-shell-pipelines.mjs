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
 ['cat private > /tmp/never | cat','unsupported syntax: simple commands only\n'],
 ['cat private | cat | cat | cat | cat','unsupported syntax: simple commands only\n'],
 ['echo okay > /tmp/redirect',''],['cat /tmp/redirect','okay\n'],
];
for(const [source,expected] of cases){await submit('clear');await submit(source);assert.equal(labels.get(out),`maia> ${source}\n${expected}`,source);assert.equal(runningProcesses.size,3);assert.equal(liveWindows.size,2);assert.equal(shellProcess.vfs.openHandleCount,0);}
// Composition must exercise the guest drain path, not a host-side VFS sink.
const baseStreams={...broker.stats};
const readFileBytes=path=>Buffer.from(shellProcess.vfs.files.get(path));
async function redirected(source,path,expected){
 await submit('clear');await submit(source);
 assert.equal(labels.get(out),`maia> ${source}\n`,source);
 assert.deepEqual(readFileBytes(path),Buffer.from(expected),source);
 assert.equal(shellProcess.vfs.openHandleCount,0);
 assert.equal(runningProcesses.size,3);assert.equal(context.pipelineTransport.owners.size,0);
 assert.deepEqual(broker.stats,baseStreams,'All temporary pipes/endpoints must be reaped before prompt');
}
await redirected('cat private | cat > /tmp/pipeline-out','/tmp/pipeline-out','OWN\n');
await redirected('cat private | cat >> /tmp/pipeline-out','/tmp/pipeline-out','OWN\nOWN\n');
await redirected('cat /shared/pipeline-[ab] | cat | cat | cat > "out file"','/home/'+shellManifest.id+'/out file','A\nB\n');
await redirected('cat private | > /tmp/target-before-command cat','/tmp/target-before-command','OWN\n');
shellProcess.vfs.files.set('/tmp/glob-output',text('old'));
await redirected('cat private | cat > /tmp/glob-out*','/tmp/glob-output','OWN\n');
shellProcess.vfs.files.set('/shared/empty',text(''));
await redirected('cat /shared/empty | cat > /tmp/empty-out','/tmp/empty-out','');
const binary=Uint8Array.from({length:65536},(_,i)=>i%256);
shellProcess.vfs.files.set('/shared/binary',binary);
await redirected('cat /shared/binary | cat | cat | cat > /tmp/binary-out','/tmp/binary-out',binary);
await redirected('cat /shared/binary | cat >> /tmp/binary-out','/tmp/binary-out',Buffer.concat([Buffer.from(binary),Buffer.from(binary)]));
await redirected('cat /shared/pipeline-a | cat > /shared/pipeline-a','/shared/pipeline-a','');
shellProcess.vfs.files.set('/shared/pipeline-a',text('A\n'));
shellProcess.vfs.files.set('/tmp/glob-second',text('keep'));
const originalStart=context.pipelineTransport.start.bind(context.pipelineTransport);let rejectedStarts=0;
context.pipelineTransport.start=(...args)=>{++rejectedStarts;return originalStart(...args);};
for(const source of [
 'cat private > /tmp/never | cat',
 'cat private | cat 2> /tmp/never',
 'cat private | cat > /tmp/never >> /tmp/other-never',
 'cat private | cat < /tmp/never',
 'echo unsupported | cat > /tmp/never',
 'cat private | echo unsupported > /tmp/never',
 'cat private | cat > /tmp/glob-*',
 'cat private | cat > /system/denied',
 'cat private | cat > /home/another/private',
]){
 await submit('clear');await submit(source);
 assert.match(labels.get(out),/unsupported|ambiguous redirection|denied/);
 assert.equal(shellProcess.vfs.files.has('/tmp/never'),false);
 assert.equal(shellProcess.vfs.files.has('/tmp/other-never'),false);
 assert.equal(shellProcess.vfs.files.has('/system/denied'),false);
 assert.equal(readFileBytes('/home/another/private').toString(),'NEVER');
 assert.equal(shellProcess.vfs.openHandleCount,0);assert.deepEqual(broker.stats,baseStreams);
}
assert.equal(rejectedStarts,0,'Invalid forms and denied targets must not submit a group');
context.pipelineTransport.start=originalStart;
// A worker diagnostic stays on terminal stderr, while stdout goes only to VFS.
await submit('clear');await submit('cat /tmp/absent | cat > /tmp/missing-out');
assert.match(labels.get(out),/cat: file or stream error/);assert.equal(readFileBytes('/tmp/missing-out').length,0);
// Startup failure may create/truncate the already-open output, but leaks nothing.
catManifest.capabilities.push('vfs.write');
await submit('clear');await submit('cat private | cat > /tmp/launch-failed');
assert.match(labels.get(out),/shell: pipeline failed/);assert.equal(readFileBytes('/tmp/launch-failed').length,0);
catManifest.capabilities.pop();assert.deepEqual(broker.stats,baseStreams);
// Real guest partial writes and WOULD_BLOCK preserve all bytes and ordering.
const originalWrite=shellProcess.vfs.write.bind(shellProcess.vfs);let writes=0;
shellProcess.vfs.write=(handle,bytes)=>{if(++writes%3===0)return -6;return originalWrite(handle,bytes.subarray(0,3));};
await redirected('cat private | cat > /tmp/partial-out','/tmp/partial-out','OWN\n');
shellProcess.vfs.write=originalWrite;
// Fail after an accepted prefix while workers are still producing a large file.
let accepted=0;
shellProcess.vfs.write=(handle,bytes)=>{if(accepted>=17)return -4;const n=originalWrite(handle,bytes.subarray(0,17-accepted));if(n>0)accepted+=n;return n;};
await submit('clear');await submit('cat /shared/binary | cat | cat | cat > /tmp/write-failed');
assert.match(labels.get(out),/redirection write failed/);
assert.deepEqual(readFileBytes('/tmp/write-failed'),Buffer.from(binary.slice(0,17)));
assert.equal(shellProcess.vfs.openHandleCount,0);assert.deepEqual(broker.stats,baseStreams);
shellProcess.vfs.write=originalWrite;
// Real VFS quota failure must retain the accepted prefix, then recover.
const quotaPrefix=new Uint8Array(1048576-31).fill(42);
shellProcess.vfs.files.set('/tmp/quota-out',quotaPrefix);
await submit('clear');await submit('cat /shared/binary | cat >> /tmp/quota-out');
assert.match(labels.get(out),/redirection write failed/);
assert.deepEqual(readFileBytes('/tmp/quota-out'),Buffer.concat([Buffer.from(quotaPrefix),Buffer.from(binary.slice(0,31))]));
assert.equal(shellProcess.vfs.openHandleCount,0);assert.deepEqual(broker.stats,baseStreams);
// Occupied owner descriptor is rejected before opening/mutating a target.
broker.connectEof({processId:shellProcess.pid,handle:3},1);
await submit('clear');await submit('cat private | cat > /tmp/collision-never');
assert.match(labels.get(out),/pipeline output busy/);assert.equal(shellProcess.vfs.files.has('/tmp/collision-never'),false);
assert.ok(broker.endpoint(shellProcess.pid,3));broker.close(shellProcess.pid,3);
assert.deepEqual(broker.stats,baseStreams);
// Stream transport failure cancels the group through the actual shell import.
const originalRead=broker.read.bind(broker);let failRead=true;
broker.read=(pid,handle,count)=>{if(failRead&&pid===shellProcess.pid&&handle===3&&count>0){failRead=false;return -8;}return originalRead(pid,handle,count);};
await submit('clear');await submit('cat /shared/binary | cat > /tmp/read-failed');
assert.match(labels.get(out),/pipeline output read failed/);broker.read=originalRead;
assert.equal(shellProcess.vfs.openHandleCount,0);assert.deepEqual(broker.stats,baseStreams);
// Close errors after successful draining/reaping are local command failures.
const originalClose=shellProcess.vfs.close.bind(shellProcess.vfs);let failClose=true;
shellProcess.vfs.close=handle=>{const n=originalClose(handle);if(failClose){failClose=false;return -4;}return n;};
await submit('clear');await submit('cat private | cat > /tmp/close-failed');
assert.match(labels.get(out),/redirection close failed/);assert.equal(readFileBytes('/tmp/close-failed').toString(),'OWN\n');
shellProcess.vfs.close=originalClose;
for(let i=0;i<15;i++)await redirected('cat private | cat > /tmp/repeat-out','/tmp/repeat-out','OWN\n');
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
console.log(`PASS actual browser boot functions/kernel scheduler/shell generated AST/MaiaGlob/cat workers/I/O/LVGL pipelines (${flushes} flushes), private delegation, unsupported-form atomicity, repeat/reap, pipeline truncate/append, partial writes and output-failure cancellation`);
