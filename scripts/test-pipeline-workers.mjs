// Actual kernel policy, separate cat WASM workers and bounded copied streams.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {KernelProcessController,encodePipelinePlan} from '../runtime/maia-kernel-processes.js';
import {KernelPipelineTransport} from '../runtime/maia-pipeline-transport.js';
import {MaiaStreamBroker} from '../runtime/maia-streams.js';
import {MaiaVfsStore} from '../runtime/maia-vfs-store.js';
import {MemoryVfsAdapter} from '../runtime/maia-vfs.js';
import {createMaiaHostImports} from '../runtime/maia-host-imports.js';
import {assertManifestCapabilities} from '../runtime/maia-capabilities.js';
const read=async path=>readFile(new URL('../'+path,import.meta.url));
const km=await WebAssembly.compile(await read('platform/desktop-web/generated/kernel.wasm')),cm=await WebAssembly.compile(await read('apps/cat/cat.wasm'));
const cat=JSON.parse(await read('apps/cat/manifest.json')),shell=JSON.parse(await read('apps/shell/manifest.json')),io=JSON.parse(await read('apps/io/manifest.json')),kernel=JSON.parse(await read('apps/kernel/kernel.json'));
if(!shell.capabilities.includes('process.pipeline'))shell.capabilities.push('process.pipeline');
const never=()=>{throw new Error('This policy/worker test must not use graphics');},graphics=Object.fromEntries(['windowCreate','labelCreate','labelSetText','buttonCreate','objectDestroy'].map(k=>[k,never]));
async function setup({failSpawn=0,trap=false,cancelParent=false}={}){
 const imports={};for(const i of WebAssembly.Module.imports(km)){imports[i.module]??={};imports[i.module][i.name]=never;}
 const ki=await WebAssembly.instantiate(km,imports),k=new KernelProcessController(ki);assert.equal(k.reserve(kernel,0),1);k.ready(1);
 const ioPid=k.reserve(io,1),pid=k.reserve(shell,2,ioPid),broker=new MaiaStreamBroker(),workers=new Map(),memories=[];
 const parent={pid,appId:shell.id,stopped:false};let spawns=0;
 const store=new MaiaVfsStore();const data=Uint8Array.from({length:131072},(_,i)=>i%256);
 const parentVfs=new MemoryVfsAdapter({store,appId:shell.id,files:{'/shared/data':data,'/shared/empty':'',[`/home/${shell.id}/private`]:'OWN','/home/another/private':'NEVER','/shared/semi;literal':'LITERAL'}});
 const transport=new KernelPipelineTransport({controller:k,streams:broker,pipeCapacity:31,
  spawn:async(a,owner)=>{
   if(++spawns===failSpawn)throw new Error('Injected worker launch failure');
   if(cancelParent){parent.stopped=true;k.exit(pid,1,true);broker.closeProcess(pid);cancelParent=false;}
   assert.equal(owner,parent);assert.equal(a.arg0,1);assertManifestCapabilities(cm,cat,cat.capabilities);
   const vfs=new MemoryVfsAdapter({store,appId:owner.appId,maxOpenFiles:cat.limits.openFiles});let worker;
   const host=createMaiaHostImports({graphics,vfs,streams:broker,processId:a.pid,processArgs:a.payload,onProcessExit:status=>stop(a.pid,status)});
   const instance=await WebAssembly.instantiate(cm,host.imports);host.attachInstance(instance);worker={pid:a.pid,host,instance,vfs,started:false,pages:instance.exports.memory.buffer.byteLength,stack:instance.exports.__stack_ptr.value};workers.set(a.pid,worker);memories.push(instance.exports.memory);
  },stop:async(p,status)=>stop(p,status)});
 function stop(p,status,trapped=false){const worker=workers.get(p);if(worker){worker.host.closeFiles();worker.host.closeStreams();assert.equal(worker.vfs.openHandleCount,0);assert.equal(worker.instance.exports.__stack_ptr.value,worker.stack);assert.equal(worker.instance.exports.memory.buffer.byteLength,worker.pages);workers.delete(p);}else broker.closeProcess(p);k.exit(p,status,trapped);}
 await transport.pump();k.ready(ioPid);k.ready(pid);
 async function run(stages,{output:returned=false,cancelOutput=false}={}){const group=transport.start(pid,encodePipelinePlan(stages,{output:returned}),parent);assert.ok(group>0);let result,output=[],stderr=[],drained=!returned,cancelled=false;
  for(let tick=0;tick<200000;++tick){await transport.pump();const p=k.next();const w=workers.get(p);
   if(w){if(!w.started){w.started=true;w.instance.exports.maia_app_start();}if(trap && w.started){stop(p,1,true);trap=false;}else w.instance.exports.maiaos_step();}
   if(returned&&!drained){const bytes=broker.read(pid,3,7);
    if(bytes instanceof Uint8Array){if(bytes.length)output.push(Buffer.from(bytes));else {broker.close(pid,3);drained=true;}}
    else if(bytes===-7)drained=true;else assert.equal(bytes,-6);
    if(cancelOutput&&!cancelled&&output.length){broker.close(pid,3);assert.equal(transport.cancel(pid,group),0);cancelled=true;drained=true;}
   }
   const b=broker.read(ioPid,4,7);if(b instanceof Uint8Array&&b.length)(returned?stderr:output).push(Buffer.from(b));
   result=drained?transport.wait(pid,group,48):-6;if(result instanceof Uint8Array){for(;;){const tail=broker.read(ioPid,4,4096);if(!(tail instanceof Uint8Array)||!tail.length)break;(returned?stderr:output).push(Buffer.from(tail));}if(returned)assert.equal(broker.endpoint(pid,3),null);return {output:Buffer.concat(output),stderr:Buffer.concat(stderr),result};}
   if(result===-7&&parent.stopped&&!workers.size)return {output:Buffer.concat(output),result:null};
   assert.equal(result,-6);
  }throw new Error('Pipeline workers did not complete');
 }
 function finish(){parent.stopped=true;k.exit(pid,0);broker.closeProcess(pid);broker.closeProcess(ioPid);assert.equal(workers.size,0);assert.equal(broker.stats.pipes,0);assert.equal(broker.stats.endpoints,0);assert.equal(transport.owners.size,0);}
 return {run,finish,data,memories,store,workers,parentVfs};
}
{
 const s=await setup();const r=await s.run([['cat','/shared/data','/shared/data'],['cat'],['cat'],['cat']]);assert.deepEqual(r.output,Buffer.concat([Buffer.from(s.data),Buffer.from(s.data)]));assert.equal(new Set(s.memories).size,4);
 assert.equal((await s.run([['cat',`/home/${shell.id}/private`,'/shared/semi;literal'],['cat']])).output.toString(),'OWNLITERAL');
 assert.equal((await s.run([['cat','/shared/empty'],['cat']])).output.length,0);
 const early=await s.run([['cat','/shared/data'],['cat','/shared/semi;literal']]);assert.equal(early.output.toString(),'LITERAL');assert.equal(new DataView(early.result.buffer).getUint32(20,true),1);
 const denied=await s.run([['cat','/home/another/private'],['cat']]);assert.match(denied.output.toString(),/cat: file or stream error/);assert.ok(!denied.output.includes(Buffer.from('NEVER')));
 for(let i=0;i<50;i++)assert.equal((await s.run([['cat','/shared/semi;literal'],['cat']])).output.toString(),'LITERAL');s.finish();
 console.log('PASS actual kernel/cat workers: four memories, 256KiB binary through 31-byte pipes, inherited private namespace, literal metacharacters, EOF, 50 repeats and cleanup');
}
for(const options of [{failSpawn:2},{trap:true}]){const s=await setup(options),r=await s.run([['cat','/shared/data'],['cat']]);assert.equal(new DataView(r.result.buffer).getUint32(12,true),1);s.finish();console.log('PASS actual worker rollback '+JSON.stringify(options));}

{const s=await setup({cancelParent:true}),result=await s.run([['cat','/shared/data'],['cat']]);assert.equal(result.result,null);s.finish();console.log('PASS actual parent cancellation during in-flight worker launch');}

{
 const s=await setup();const r=await s.run([['cat','/shared/data','/shared/data'],['cat'],['cat'],['cat']],{output:true});
 assert.deepEqual(r.output,Buffer.concat([Buffer.from(s.data),Buffer.from(s.data)]));assert.equal(r.stderr.length,0);
 const cancelled=await s.run([['cat','/shared/data'],['cat']],{output:true,cancelOutput:true});
 assert.deepEqual(cancelled.output,Buffer.from(s.data.slice(0,cancelled.output.length)));
 assert.equal(new DataView(cancelled.result.buffer).getUint32(12,true),1);
 const recovered=await s.run([['cat','/shared/semi;literal'],['cat']],{output:true});assert.equal(recovered.output.toString(),'LITERAL');
 s.finish();console.log('PASS actual v2 workers: 256KiB return pipe, owner drain, downstream cancellation and resource recovery');
}
for(const options of [{failSpawn:2},{trap:true},{cancelParent:true}]){
 const s=await setup(options),r=await s.run([['cat','/shared/data'],['cat']],{output:true});
 if(options.cancelParent)assert.equal(r.result,null);else assert.equal(new DataView(r.result.buffer).getUint32(12,true),1);
 s.finish();console.log('PASS actual v2 rollback '+JSON.stringify(options));
}
