// Actual kernel WASM policy tests; graphics fixtures are unused by this unit.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {KernelProcessController,encodePipelinePlan} from '../runtime/maia-kernel-processes.js';
const module=await WebAssembly.compile(await readFile(new URL('../platform/desktop-web/generated/kernel.wasm',import.meta.url)));
async function setup({writable=true}={}){const never=()=>{throw new Error('Policy test must not call graphics/VFS');};const imports={};for(const item of WebAssembly.Module.imports(module)){imports[item.module]??={};imports[item.module][item.name]=never;}
 const instance=await WebAssembly.instantiate(module,imports),k=new KernelProcessController(instance);
 const kernel=JSON.parse(await readFile(new URL('../apps/kernel/kernel.json',import.meta.url),'utf8')),io=JSON.parse(await readFile(new URL('../apps/io/manifest.json',import.meta.url),'utf8')),shell=JSON.parse(await readFile(new URL('../apps/shell/manifest.json',import.meta.url),'utf8'));shell.capabilities.push('process.pipeline');if(!writable)shell.capabilities=shell.capabilities.filter(c=>c!=='vfs.write');
 assert.equal(k.reserve(kernel,0),1);assert.equal(k.ready(1),0);const ioPid=k.reserve(io,1);assert.ok(ioPid>1);const pid=k.reserve(shell,2,ioPid);assert.ok(pid>ioPid);
 const actions=[];for(let attempts=0,a;(a=k.action());++attempts){assert.ok(attempts<16,'Boot actions must complete within their bound');assert.deepEqual(k.action(),a,'Pending action must be stable across transport retries');actions.push(a);assert.equal(k.acknowledge(a.id),0);}
 assert.deepEqual(actions.map(a=>a.kind),[1,1,2,2]);assert.equal(k.ready(ioPid),0);assert.equal(k.ready(pid),0);return {k,pid,ioPid,instance,ioManifest:io,shellManifest:shell};
}
{
 const {k,pid,ioPid,instance}=await setup(),stack=instance.exports.__stack_ptr.value;
 const plan=encodePipelinePlan([['cat','/shared/a'],['cat']]);
 assert.equal(k.start(ioPid,plan),-3);const broken=plan.slice();new DataView(broken.buffer).setUint32(12,0xffffffff,true);assert.equal(k.start(pid,broken),-1);
 for(let repeat=0;repeat<100;repeat++){
  const group=k.start(pid,plan);assert.ok(group>0);assert.equal(k.wait(ioPid,group,48),-3);assert.equal(k.wait(pid,group,48),-6);
  const starts=[];for(let a;(a=k.action());){if(a.kind===3){starts.push(a);assert.equal(new DataView(a.payload.buffer).getUint32(0,true),1);}assert.equal(k.acknowledge(a.id),0);}
  assert.equal(starts.length,2);assert.notEqual(starts[0].pid,starts[1].pid);assert.equal(k.wait(pid,group,48),-6);
  assert.equal(k.exit(starts[0].pid,0),0);assert.equal(k.exit(starts[1].pid,0),0);assert.equal(k.wait(pid,group,16),-4);
  const result=k.wait(pid,group,48);assert.equal(result.length,32);assert.equal(new DataView(result.buffer).getUint32(12,true),0);assert.equal(k.wait(pid,group,48),-7);
 }
 assert.equal(instance.exports.__stack_ptr.value,stack);console.log('PASS kernel process policy: 100 reserved/launched/completed/reaped groups, separate IDs, bounds and wait ownership');
}
for(const failure of ['launch','trap','parent-in-flight']){
 const {k,pid}=await setup(),group=k.start(pid,encodePipelinePlan([['cat','/shared/a'],['cat'],['cat']]));const started=[];let injected=false;
 for(let count=0;count<100;count++){
  const a=k.action();if(!a)break;
  if(a.kind===3){if(!injected && failure==='parent-in-flight'){k.exit(pid,1,true);injected=true;}
   if(!injected && failure==='launch' && started.length===1){k.acknowledge(a.id,-4);injected=true;continue;}
   started.push(a.pid);
  }
  assert.equal(k.acknowledge(a.id),0);
 }
 if(failure==='trap'){assert.equal(k.exit(started[0],1,true),0);for(let a;(a=k.action());)k.acknowledge(a.id);}
 if(failure!=='parent-in-flight'){const result=k.wait(pid,group,48);assert.ok(result instanceof Uint8Array);assert.equal(new DataView(result.buffer).getUint32(12,true),1);}
 else assert.equal(k.wait(pid,group,48),-7);
 console.log('PASS kernel rollback '+failure);
}

{
 const {k,pid,ioManifest,shellManifest}=await setup();const group=k.start(pid,encodePipelinePlan([['cat','/shared/a'],['cat']]));const children=[];
 for(let a;(a=k.action());){if(a.kind===3)children.push(a.pid);k.acknowledge(a.id);}
 for(const child of children)k.exit(child,0);
 // Parent disappears after completion but before wait; completed reservations
 // must still be reaped so a new four-stage group can reserve its full budget.
 k.exit(pid,1,true);const io=k.reserve(ioManifest,1),next=k.reserve(shellManifest,2,io);
 for(let a;(a=k.action());)k.acknowledge(a.id);k.ready(io);k.ready(next);
 assert.ok(k.start(next,encodePipelinePlan([['cat','/shared/a'],['cat'],['cat'],['cat']]))>0);
 console.log('PASS completed orphan group reaping and full quota reuse');
}
{
 const {k,pid}=await setup();const valid=encodePipelinePlan([['cat','/shared/a'],['cat']]);
 for(const change of [packet=>new DataView(packet.buffer).setUint32(16,99,true),packet=>new DataView(packet.buffer).setUint32(12,0xffffffff,true),packet=>{packet[packet.length-1]=0xff;},packet=>new DataView(packet.buffer).setUint32(4,5,true)]){
  const packet=valid.slice();change(packet);assert.equal(k.start(pid,packet),-1);
 }
 assert.equal(k.start(pid,valid),1,'Invalid plans must not consume group identity/resources');
 console.log('PASS malformed packet atomicity, UTF-8 rejection and no reservation side effects');
}
{
 const {k}=await setup();const app={id:'org.test.slot',limits:{memoryPages:1,openFiles:0},capabilities:[]};
 const old=k.reserve(app,2);assert.ok(old>0);assert.equal(k.ready(old,-1),0);const action=k.action();assert.equal(action.pid,old);
 assert.equal(k.exit(old,1),0);const replacement=k.reserve(app,2);assert.ok(replacement>old);
 assert.equal(k.acknowledge(action.id),0);assert.equal(k.ready(replacement),0,'An old async completion must not clear a reused table slot');
 console.log('PASS stale boot action acknowledgment preserves a new process in a reused slot');
}

// Version 2 returns final stdout to owner stream 3, with owner-only cancellation.
const outputPlan=()=>encodePipelinePlan([['cat','/shared/a'],['cat']],{output:true});
{
 const {k,pid,ioPid}=await setup();
 for(let repeat=0;repeat<100;repeat++){
  const plan=outputPlan(),group=k.start(pid,plan);assert.ok(group>0);
  assert.equal(k.start(pid,plan),-4,'One unreaped group reserves owner stream 3');
  for(let i=0;i<32;i++)assert.notEqual(k.next(),pid,'Owner blocked until all startup acknowledgements');
  const children=[],pipes=[];
  for(let a;(a=k.action());){if(a.kind===3){children.push(a.pid);assert.equal(new DataView(a.payload.buffer).getUint32(0,true),1,'Worker argv remains version 1');}if(a.kind===1)pipes.push(a);k.acknowledge(a.id);}
  assert.equal(pipes.at(-1).pid,pid);assert.equal(pipes.at(-1).arg0,3);assert.equal(pipes.at(-1).arg1,children.at(-1));
  const runnable=new Set(Array.from({length:32},()=>k.next()));for(const p of [pid,...children])assert.ok(runnable.has(p),'Kernel schedules owner drain alongside producers');
  assert.equal(k.cancel(ioPid,group),-3);assert.equal(k.wait(ioPid,group,48),-3);
  for(const child of children)k.exit(child,0);
  assert.equal(k.wait(pid,group,16),-4);assert.equal(k.action(),null,'Short wait must not discard output');
  assert.equal(k.wait(pid,group,48),-6);assert.equal(k.start(pid,plan),-4);
  const release=k.action();assert.equal(release.kind,5);assert.equal(release.pid,pid);assert.equal(release.arg0,3);
  // Even a transport failure must not mark the owner endpoint as released.
  if(!repeat){k.acknowledge(release.id,-4);assert.equal(k.wait(pid,group,48),-6);const retry=k.action();assert.equal(retry.kind,5);k.acknowledge(retry.id);}else k.acknowledge(release.id);
  const result=k.wait(pid,group,48);assert.equal(result.length,32);assert.equal(new DataView(result.buffer).getUint32(12,true),0);
  assert.equal(k.cancel(pid,group),-7);
 }
 console.log('PASS v2 kernel: 100 groups, owner scheduling, reserved descriptor, v1 argv, acknowledged cleanup and ownership');
}
{
 const {k,pid}=await setup({writable:false});assert.equal(k.start(pid,outputPlan()),-3);
 assert.ok(k.start(pid,encodePipelinePlan([['cat','/shared/a'],['cat']]))>0,'Read-only owner still supports v1');
}
{
 const {k,pid}=await setup(),valid=outputPlan();
 for(const [offset,value] of [[0,3],[16,0],[16,2],[20,1],[4,5],[8,13],[12,0xffffffff],[24,99],[28,0],[40,0xffffffff]]){
  const bad=valid.slice();new DataView(bad.buffer).setUint32(offset,value,true);assert.equal(k.start(pid,bad),-1,`Malformed v2 field ${offset}`);
 }
 const truncated=valid.slice(0,20);assert.equal(k.start(pid,truncated),-1);assert.equal(k.start(pid,valid),1);
 console.log('PASS v2 malformed packet atomicity and separate write authorization');
}
for(const failure of ['cancel-start','cancel-pipe-in-flight','cancel-running','cancel-complete','parent-complete','trap','collision']){
 const {k,pid}=await setup(),group=k.start(pid,outputPlan());let injected=false,bound=false;const children=[];
 for(let steps=0;steps<100;steps++){
  const a=k.action();if(!a)break;
  if(a.kind===3)children.push(a.pid);
  if(!injected && ((failure==='cancel-start' && a.kind===3) || (failure==='cancel-pipe-in-flight' && a.kind===1 && a.pid===pid))){assert.equal(k.cancel(pid,group),0);assert.equal(k.cancel(pid,group),0);injected=true;}
  if(a.kind===1 && a.pid===pid){if(failure==='collision'){k.acknowledge(a.id,-4);injected=true;continue;}bound=true;}
  if(a.kind===5 && a.pid===pid){assert.ok(bound,'Never close a colliding, unowned descriptor');bound=false;}
  k.acknowledge(a.id);
 }
 if(failure==='cancel-running'){k.cancel(pid,group);injected=true;}
 if(failure==='trap'){k.exit(children[0],1,true);injected=true;}
 if(failure==='cancel-complete' || failure==='parent-complete'){for(const child of children)k.exit(child,0);if(failure==='cancel-complete')k.cancel(pid,group);else k.exit(pid,1,true);injected=true;}
 for(let a;(a=k.action());){if(a.kind===5 && a.pid===pid)bound=false;k.acknowledge(a.id);}
 assert.ok(injected);assert.equal(bound,false);
 if(failure==='parent-complete')assert.equal(k.wait(pid,group,48),-7);else {const result=k.wait(pid,group,48);assert.equal(result.length,32);assert.equal(new DataView(result.buffer).getUint32(12,true),1);}
 console.log('PASS v2 rollback '+failure);
}
