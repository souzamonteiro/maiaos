import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMaiaHostImports} from '../runtime/maia-host-imports.js';
import {MemoryVfsAdapter} from '../runtime/maia-vfs.js';
import {MaiaStreamBroker} from '../runtime/maia-streams.js';
import {assertManifestCapabilities} from '../runtime/maia-capabilities.js';
const manifest=JSON.parse(await readFile(new URL('../apps/shell/manifest.json',import.meta.url),'utf8'));
const module=await WebAssembly.compile(await readFile(new URL('../apps/shell/shell.wasm',import.meta.url)));
for (const capability of ['vfs.opendir','vfs.readdir']) {
  assert.throws(()=>assertManifestCapabilities(module,{...manifest,capabilities:manifest.capabilities.filter(c=>c!==capability)},manifest.capabilities),/Manifest does not request/);
  assert.throws(()=>assertManifestCapabilities(module,manifest,manifest.capabilities.filter(c=>c!==capability)),/Host policy denies/);
}
const encoder=new TextEncoder();
const unavailable=()=>{throw new Error('Shell must not use graphics');};
const graphics=Object.fromEntries(['windowCreate','labelCreate','labelSetText','buttonCreate','objectDestroy'].map(n=>[n,unavailable]));
async function shell({broker=new MaiaStreamBroker(),pid=3,peer=2,files={},capacity=31}={}) {
  broker.connect({reader:{processId:pid,handle:0},writer:{processId:peer,handle:3},capacity:256});
  broker.connect({reader:{processId:peer,handle:4},writer:{processId:pid,handle:1},capacity});
  broker.alias(pid,1,2);broker.alias(peer,4,5);
  const vfs=new MemoryVfsAdapter({appId:manifest.id,maxOpenFiles:manifest.limits.openFiles,files});
  let exit=null,steps=0;
  const host=createMaiaHostImports({vfs,graphics,pipeline:{start(){throw new Error("Unexpected pipeline in builtin-only regression");},wait(){throw new Error("Unexpected pipeline wait");}},streams:broker,processId:pid,onProcessExit:code=>{exit=code;}});
  const instance=await WebAssembly.instantiate(module,host.imports);host.attachInstance(instance);
  instance.exports.maia_app_start();const stack=instance.exports.__stack_ptr.value;
  const memory=instance.exports.memory.buffer.byteLength;
  function step(){if(exit===null){instance.exports.maiaos_step();++steps;}}
  function read(){const bytes=broker.read(peer,4,7);return bytes instanceof Uint8Array ? Buffer.from(bytes):Buffer.alloc(0);}
  function untilPrompt(){const chunks=[];
    for(let tick=0;tick<30000;++tick){step();chunks.push(read());
      const size=chunks.reduce((sum,chunk)=>sum+chunk.length,0);
      if(size>=6&&broker.stats.bufferedBytes===0&&vfs.openHandleCount===0){const data=Buffer.concat(chunks);if(data.subarray(-6).toString()==='maia> ')return data.toString('utf8');}
    }throw new Error('Guest failed to yield/drain a complete command');
  }
  untilPrompt();
  return {instance,vfs,host,broker,step,get steps(){return steps;},get exit(){return exit;},
    stable(){assert.equal(instance.exports.__stack_ptr.value,stack);assert.equal(instance.exports.memory.buffer.byteLength,memory);},
    run(source){assert.equal(broker.write(peer,3,encoder.encode(source+'\n')),encoder.encode(source+'\n').length);return untilPrompt();},
    finish(){broker.close(peer,3);for(let i=0;i<10;++i){step();read();}assert.equal(exit,0);broker.closeProcess(peer);this.stable();assert.equal(vfs.openHandleCount,0);},
  };
}
{
  const files={};const names=[];
  for(let i=0;i<1024;++i){const name='item'+String(i).padStart(4,'0');names.push(name);files['/shared/large/'+name]='fixture';}
  const s=await shell({files});assert.equal(s.run('ls /shared/large'),names.join('\n')+'\nmaia> ');
  assert.ok(s.steps>1024,'Tiny output ring must require cooperative resumption');s.stable();s.finish();
  assert.equal(s.broker.stats.endpoints,0);assert.equal(s.broker.stats.pipes,0);
}
{
  const broker=new MaiaStreamBroker();const a=await shell({broker,pid:3,peer:2});const b=await shell({broker,pid:4,peer:5});
  assert.notEqual(a.instance.exports.memory,b.instance.exports.memory);
  assert.equal(a.run('cd /system'),'maia> ');assert.equal(a.run('pwd'),'/system\nmaia> ');assert.equal(b.run('pwd'),'/\nmaia> ');
  assert.equal(b.run('cd'),'maia> ');assert.equal(a.run('pwd'),'/system\nmaia> ');
  for(let i=0;i<1000;++i){assert.equal(a.run('ls'),'welcome.txt\nmaia> ');assert.equal(a.run('cd .'),'maia> ');}
  a.stable();b.stable();a.finish();b.finish();assert.equal(broker.stats.pipes,0);assert.equal(broker.stats.endpoints,0);
}
{
  const segments=['shared',...Array(11).fill('a'.repeat(90)),'b'.repeat(14)];const target='/'+segments.join('/');assert.equal(target.length,1023);
  const s=await shell({files:{[target+'/over/note.txt']:''}});
  for(const segment of segments)assert.equal(s.run('cd '+segment),'maia> ');
  assert.equal(s.run('pwd'),target+'\nmaia> ');
  assert.equal(s.run('cd over/..'),'maia> ');
  assert.equal(s.run('cd over'),'cd: invalid path or directory entry\nmaia> ');
  assert.equal(s.run('pwd'),target+'\nmaia> ');assert.equal(s.run('cd ..'),'maia> ');
  assert.equal(s.run('pwd'),'/'+segments.slice(0,-1).join('/')+'\nmaia> ');s.finish();
}
// Abrupt terminal closure while ls owns a snapshot must release it before exit.
{
  const s=await shell();
  s.broker.write(2,3,encoder.encode('ls /\n'));s.step();
  assert.equal(s.vfs.openHandleCount,1);
  s.broker.closeProcess(2);s.step();
  assert.equal(s.exit,1);assert.equal(s.vfs.openHandleCount,0);s.stable();
  assert.equal(s.broker.stats.pipes,0);assert.equal(s.broker.stats.endpoints,0);
}
// EOF with a final unterminated ls drains the listing and exits without a prompt.
{
  const s=await shell();s.broker.write(2,3,encoder.encode('ls /system'));s.broker.close(2,3);
  const chunks=[];
  for(let tick=0;tick<20;++tick){s.step();const data=s.broker.read(2,4,4096);if(data instanceof Uint8Array)chunks.push(data);}
  assert.equal(Buffer.concat(chunks).toString(),'welcome.txt\n');assert.equal(s.exit,0);
  s.stable();assert.equal(s.vfs.openHandleCount,0);s.broker.closeProcess(2);assert.equal(s.broker.stats.pipes,0);
}
// Reject malformed host packets in the real guest; never print a partial entry.
for(const fault of ['version','type','length','reserved','slash','nul','short']) {
  const s=await shell();const normal=s.vfs.readdir.bind(s.vfs);
  s.vfs.readdir=(handle,capacity)=>{const packet=normal(handle,capacity);if(!packet.length)return packet;
    const header=new DataView(packet.buffer,packet.byteOffset,packet.length);
    if(fault==='version')header.setUint32(0,2,true);
    if(fault==='type')header.setUint32(4,3,true);
    if(fault==='length')header.setUint32(8,256,true);
    if(fault==='reserved')header.setUint32(12,1,true);
    if(fault==='slash')packet[16]=47;
    if(fault==='nul')packet[17]=0;
    return fault==='short'?packet.slice(0,16):packet;
  };
  assert.equal(s.run('ls /system'),'ls: invalid path or directory entry\nmaia> ');assert.equal(s.vfs.openHandleCount,0);s.finish();
}
console.log('Actual shell directory WASM passed: 1024-entry ls through a 31-byte ring, two isolated cwd instances, 1000 ls/cd cycles, exact 1023-byte path boundary, capability denial and malformed-packet cleanup.');
