// Actual C++98 shell WASM, existing VFS callbacks and bounded byte streams.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMaiaHostImports} from '../runtime/maia-host-imports.js';
import {MemoryVfsAdapter, VFS_FLAGS} from '../runtime/maia-vfs.js';
import {MaiaStreamBroker} from '../runtime/maia-streams.js';
import {assertManifestCapabilities} from '../runtime/maia-capabilities.js';
const manifest=JSON.parse(await readFile(new URL('../apps/shell/manifest.json',import.meta.url),'utf8'));
const module=await WebAssembly.compile(await readFile(new URL('../apps/shell/shell.wasm',import.meta.url)));
assertManifestCapabilities(module,manifest,manifest.capabilities);
const encoder=new TextEncoder();
const prompt=Buffer.from('maia> ');
const forbidden=()=>{throw new Error('Shell must not invoke graphics');};
const graphics=Object.fromEntries(['windowCreate','labelCreate','labelSetText','buttonCreate','objectDestroy'].map(name=>[name,forbidden]));
async function shell({files={},capacity=31}={}) {
  const broker=new MaiaStreamBroker();
  broker.connect({reader:{processId:3,handle:0},writer:{processId:2,handle:3},capacity:256});
  broker.connect({reader:{processId:2,handle:4},writer:{processId:3,handle:1},capacity});
  broker.alias(3,1,2);broker.alias(2,4,5);
  const vfs=new MemoryVfsAdapter({appId:manifest.id,maxOpenFiles:manifest.limits.openFiles,files});

  let exit=null,steps=0;
  const host=createMaiaHostImports({vfs,graphics,pipeline:{start(){throw new Error("Unexpected pipeline in builtin-only regression");},wait(){throw new Error("Unexpected pipeline wait");}},streams:broker,processId:3,onProcessExit:code=>{exit=code;}});
  const instance=await WebAssembly.instantiate(module,host.imports);host.attachInstance(instance);
  instance.exports.maia_app_start();
  const stack=instance.exports.__stack_ptr.value, memory=instance.exports.memory.buffer.byteLength;
  function step(){if(exit===null){instance.exports.maiaos_step();++steps;}}
  function receive(){return broker.read(2,4,17);}
  function untilPrompt(expectedHandles=0){const chunks=[];
    for(let tick=0;tick<100000;++tick){step();const bytes=receive();
      if(bytes instanceof Uint8Array&&bytes.length)chunks.push(Buffer.from(bytes));
      // Require a quiescent scheduler step: file bytes may themselves end in a prompt.
      if(bytes===-6&&broker.stats.bufferedBytes===0&&vfs.openHandleCount===expectedHandles){
        const result=Buffer.concat(chunks);if(result.subarray(-prompt.length).equals(prompt))return result;
      }
    }throw new Error('cat failed to drain/yield');
  }
  untilPrompt();
  return {vfs,broker,host,instance,step,receive,untilPrompt,get exit(){return exit;},get steps(){return steps;},
    stable(){assert.equal(instance.exports.__stack_ptr.value,stack);assert.equal(instance.exports.memory.buffer.byteLength,memory);},
    send(source,newline=true){const bytes=encoder.encode(source+(newline?'\n':''));assert.equal(broker.write(2,3,bytes),bytes.length);},
    run(source){const count=vfs.openHandleCount;this.send(source);return untilPrompt(count);},
    text(source){return this.run(source).toString('utf8');},
    finish(){broker.close(2,3);for(let tick=0;tick<10;++tick){step();receive();}assert.equal(exit,0);broker.closeProcess(2);this.stable();assert.equal(vfs.openHandleCount,0);assert.equal(broker.stats.pipes,0);assert.equal(broker.stats.endpoints,0);},
  };
}assert.throws(()=>assertManifestCapabilities(module,manifest,manifest.capabilities.filter(c=>c!=='vfs.write')),/Host policy denies/);
assert.throws(()=>assertManifestCapabilities(module,{...manifest,capabilities:manifest.capabilities.filter(c=>c!=='vfs.write')},manifest.capabilities),/Manifest does not request/);
const contents=(s,path)=>Buffer.from(s.vfs.files.get(path));
{
 const s=await shell({files:{'/tmp/in':Buffer.from([0,255,65,10]),'/shared/target-a':'old','/shared/target-b':'keep'}});
 assert.equal(s.text('echo one > /tmp/out'),'maia> ');assert.equal(contents(s,'/tmp/out').toString(),'one\n');
 assert.equal(s.text('echo two >> /tmp/out'),'maia> ');assert.equal(contents(s,'/tmp/out').toString(),'one\ntwo\n');
 assert.equal(s.text('> /tmp/out echo prefix'),'maia> ');assert.equal(contents(s,'/tmp/out').toString(),'prefix\n');
 assert.equal(s.text('echo > /tmp/out a b'),'maia> ');assert.equal(contents(s,'/tmp/out').toString(),'a b\n');
 assert.equal(s.text('cat /tmp/in /tmp/in > /tmp/out'),'maia> ');assert.deepEqual(contents(s,'/tmp/out'),Buffer.from([0,255,65,10,0,255,65,10]));
 assert.equal(s.text('cat /tmp/out > /tmp/out'),'maia> ');assert.equal(contents(s,'/tmp/out').length,0);
 assert.equal(s.text('echo quoted > "/tmp/é file"'),'maia> ');assert.equal(contents(s,'/tmp/é file').toString(),'quoted\n');
 assert.equal(s.text('echo literal > "/tmp/*.literal"'),'maia> ');assert.equal(contents(s,'/tmp/*.literal').toString(),'literal\n');
 assert.equal(s.text('echo matched > /shared/target-a*'),'maia> ');assert.equal(contents(s,'/shared/target-a').toString(),'matched\n');
 assert.equal(s.text('echo NEVER > /shared/target-*'),'shell: ambiguous redirection\nmaia> ');assert.equal(contents(s,'/shared/target-a').toString(),'matched\n');assert.equal(contents(s,'/shared/target-b').toString(),'keep');
 assert.equal(s.text('echo unmatched > /tmp/new*'),'maia> ');assert.equal(contents(s,'/tmp/new*').toString(),'unmatched\n');
 assert.equal(s.text('cat > /tmp/usage'),'usage: cat <file> [file ...]\nmaia> ');assert.equal(contents(s,'/tmp/usage').length,0);
 assert.equal(s.text('echo "" > /tmp/empty'),'maia> ');assert.equal(contents(s,'/tmp/empty').toString(),'\n');
 assert.equal(s.text('cd /tmp'),'maia> ');assert.equal(s.text('pwd > relative'),'maia> ');assert.equal(contents(s,'/tmp/relative').toString(),'/tmp\n');
 assert.equal(s.text('echo terminal'),'terminal\nmaia> ');
 assert.equal(s.text('echo hi > ""'),'shell: invalid redirection path\nmaia> ');
 for(const target of ['/system/x','/apps/x','/home/another/private'])assert.equal(s.text('echo NEVER > '+target),'shell: redirection: permission denied\nmaia> ');
 for(const target of ['/tmp','/tmp/in/child'])assert.match(s.text('echo NEVER > '+target),/^shell: redirection: /);
 for(const command of ['echo hidden > /tmp/syntax > /tmp/other','echo hidden 2> /tmp/syntax','echo hidden < /tmp/in','echo hidden | cat > /tmp/syntax','echo hidden > /tmp/syntax &'])assert.equal(s.text(command),'unsupported syntax: simple commands only\nmaia> ');
 assert.equal(s.vfs.files.has('/tmp/syntax'),false);
 assert.equal(s.text('echo '+Array(10).fill('a').join(' ')+' > /tmp/limit'),'maia> ');
 const before=contents(s,'/tmp/limit');assert.equal(s.text('echo '+Array(11).fill('a').join(' ')+' > /tmp/limit'),'shell input limit exceeded\nmaia> ');assert.deepEqual(contents(s,'/tmp/limit'),before);
 for(let i=0;i<100;i++)assert.equal(s.text('echo repeat >> /tmp/repeated'),'maia> ');
 assert.equal(contents(s,'/tmp/repeated').toString(),'repeat\n'.repeat(100));s.stable();s.finish();
}
{
 const data=Uint8Array.from({length:131072},(_,i)=>i%256),s=await shell({files:{'/tmp/in':data}});
 const original=s.vfs.write.bind(s.vfs);let waits=0,peak=0;
 s.vfs.write=(fd,bytes)=>{peak=Math.max(peak,s.vfs.openHandleCount);if(waits++%3===0)return -6;return original(fd,bytes.subarray(0,7));};
 assert.equal(s.text('cat /tmp/in /tmp/in > /tmp/out'),'maia> ');assert.deepEqual(contents(s,'/tmp/out'),Buffer.concat([Buffer.from(data),Buffer.from(data)]));assert.equal(peak,2);
 s.stable();s.finish();
}
{
 const s=await shell({files:{'/tmp/in':'x'.repeat(1024),'/tmp/never':'NEVER'}}),original=s.vfs.write.bind(s.vfs),open=s.vfs.open.bind(s.vfs);let accepted=0;const paths=[];
 s.vfs.open=(path,flags)=>{paths.push(path);return open(path,flags);};
 s.vfs.write=(fd,bytes)=>{if(accepted>=17)return -4;const chunk=bytes.subarray(0,17-accepted),n=original(fd,chunk);accepted+=n;return n;};
 assert.equal(s.text('cat /tmp/in /tmp/never > /tmp/out'),'shell: redirection write failed\nmaia> ');
 assert.equal(contents(s,'/tmp/out').toString(),'x'.repeat(17));assert.deepEqual(paths,['/tmp/out','/tmp/in']);assert.equal(s.vfs.openHandleCount,0);
 assert.equal(s.text('echo recovered'),'recovered\nmaia> ');s.finish();
}
{
 const s=await shell();s.send('echo final > /tmp/eof',false);s.broker.close(2,3);
 const chunks=[];for(let i=0;i<100;i++){s.step();const b=s.receive();if(b instanceof Uint8Array)chunks.push(Buffer.from(b));if(s.exit!==null)break;}
 assert.equal(s.exit,0);assert.equal(Buffer.concat(chunks).length,0);assert.equal(contents(s,'/tmp/eof').toString(),'final\n');assert.equal(s.vfs.openHandleCount,0);s.broker.closeProcess(2);s.stable();
}
{
 const s=await shell();s.send('exit > /tmp/exit');
 for(let i=0;i<20&&s.exit===null;i++){s.step();s.receive();}
 assert.equal(s.exit,0);assert.equal(contents(s,'/tmp/exit').length,0);assert.equal(s.vfs.openHandleCount,0);s.broker.closeProcess(2);s.stable();
}
console.log('Actual shell WASM redirection passed: create/truncate/append, AST positions, quote/glob targets, ambiguity atomicity, capabilities, permissions, binary/partial writes, bounded retries, failure-prefix cleanup, EOF and stable memory.');
