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
const forbidden=()=>{throw new Error('Shell expansion must not invoke graphics');};
const graphics=Object.fromEntries(['windowCreate','labelCreate','labelSetText','buttonCreate','objectDestroy'].map(name=>[name,forbidden]));
async function shell({files={},capacity=31}={}) {
  const broker=new MaiaStreamBroker();
  broker.connect({reader:{processId:3,handle:0},writer:{processId:2,handle:3},capacity:256});
  broker.connect({reader:{processId:2,handle:4},writer:{processId:3,handle:1},capacity});
  broker.alias(3,1,2);broker.alias(2,4,5);
  const vfs=new MemoryVfsAdapter({appId:manifest.id,maxOpenFiles:manifest.limits.openFiles,files});
  vfs.write=()=>{throw new Error('cat must never write VFS files');};
  const openedPaths=[],openDirectory=vfs.opendir.bind(vfs);
  vfs.opendir=path=>{const handle=openDirectory(path);if(handle>0)openedPaths.push(path);return handle;};
  let exit=null,steps=0;
  const host=createMaiaHostImports({vfs,graphics,pipeline:{cancel(){throw new Error("Unexpected pipeline cancellation");},start(){throw new Error("Unexpected pipeline in builtin-only regression");},wait(){throw new Error("Unexpected pipeline wait");}},streams:broker,processId:3,onProcessExit:code=>{exit=code;}});
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
    }throw new Error('Shell expansion failed to drain/yield');
  }
  untilPrompt();
  return {vfs,openedPaths,broker,host,instance,step,receive,untilPrompt,get exit(){return exit;},get steps(){return steps;},
    stable(){assert.equal(instance.exports.__stack_ptr.value,stack);assert.equal(instance.exports.memory.buffer.byteLength,memory);},
    send(source,newline=true){const bytes=encoder.encode(source+(newline?'\n':''));assert.equal(broker.write(2,3,bytes),bytes.length);},
    run(source){const count=vfs.openHandleCount;this.send(source);return untilPrompt(count);},
    text(source){return this.run(source).toString('utf8');},
    finish(){broker.close(2,3);for(let tick=0;tick<10;++tick){step();receive();}assert.equal(exit,0);broker.closeProcess(2);this.stable();assert.equal(vfs.openHandleCount,0);assert.equal(broker.stats.pipes,0);assert.equal(broker.stats.endpoints,0);},
  };
}
const base='/shared/glob/';
const names=['b.txt','a.txt','two words.txt','é.txt','🌍.txt','x[1].txt'];
const ordered=names.toSorted((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
{
  const files=Object.fromEntries(names.map(n=>[base+n,'data']));
  Object.assign(files,{[base+'.secret.txt']:'hidden',[base+'child/deep.txt']:'deep',
    '/home/another/secret.txt':'NEVER EXPOSE','/home/org.maiaplatform.shell/own.txt':'own'});
  const s=await shell({files});assert.equal(s.text('cd /shared/glob'),'maia> ');
  assert.equal(s.text('echo *.txt'),ordered.join(' ')+'\nmaia> ');
  for(const command of ['echo "*.txt"',String.raw`echo \*.txt`,'echo "*".txt'])assert.equal(s.text(command),'*.txt\nmaia> ');
  assert.equal(s.text("echo '*.txt'"),'*.txt\nmaia> ');
  assert.equal(s.text('echo "two "*'),'two words.txt\nmaia> ');
  assert.equal(s.text('echo "é"*'),'é.txt\nmaia> ');
  assert.equal(s.text('echo [ab].txt'),'a.txt b.txt\nmaia> ');
  assert.equal(s.text('echo b* a*'),'b.txt a.txt\nmaia> ');
  assert.equal(s.text('echo \"[ab]\".txt'),'[ab].txt\nmaia> ');
  assert.equal(s.text('echo .*.txt'),'.secret.txt\nmaia> ');
  assert.equal(s.text('echo */*.txt'),'child/deep.txt\nmaia> ');
  assert.equal(s.text('echo missing*'),'missing*\nmaia> ');
  assert.equal(s.text('echo ['),'shell: invalid filename pattern\nmaia> ');
  assert.equal(s.text(String.raw`echo "a\q"`),'a\\q\nmaia> ');
  assert.equal(s.text('ls a.txt b.txt'),'a.txt\nb.txt\nmaia> ');
  assert.equal(s.text('ls *.txt'),ordered.join('\n')+'\nmaia> ');
  assert.equal(s.text('ls child a.txt missing b.txt'),'child:\ndeep.txt\na.txt\nls: no such directory\nb.txt\nmaia> ');
  assert.equal(s.text('ls a.txt/'),'ls: not a directory\nmaia> ');
  assert.equal(s.text('ls -a'),'usage: ls [path ...]\nmaia> ');
  assert.equal(s.text('echo /home/*/*.txt'),'/home/org.maiaplatform.shell/own.txt\nmaia> ');
  assert.equal(s.text('echo ./*.txt'),ordered.map(n=>'./'+n).join(' ')+'\nmaia> ');
  assert.equal(s.text('echo child/../[ab].txt'),'child/../a.txt child/../b.txt\nmaia> ');
  assert.equal(s.text('ls /home/another/secret.txt a.txt'),'ls: permission denied\na.txt\nmaia> ');
  for(let i=0;i<200;i++)assert.equal(s.text('echo [ab].txt'),'a.txt b.txt\nmaia> ');
  s.stable();s.finish();
}
{
  const files={};for(let i=0;i<12;i++)files['/shared/overflow/'+String(i).padStart(2,'0')]='x';
  files['/shared/long/'+ 'x'.repeat(96)]='x';
  files['/shared/deep/a/b/c/d/x.txt']='x';
  const s=await shell({files});
  assert.equal(s.text('echo BEFORE /shared/overflow/* AFTER'),'shell: filename expansion limit exceeded\nmaia> ');
  assert.equal(s.text('echo /shared/deep/*/*/*/*/*.txt'),'shell: filename expansion limit exceeded\nmaia> ');
  assert.equal(s.vfs.openHandleCount,0);
  assert.equal(s.text('cd /shared/long'),'maia> ');
  assert.equal(s.text('echo *'),'shell: filename expansion limit exceeded\nmaia> ');
  assert.equal(s.text('echo after'),'after\nmaia> ');s.stable();s.finish();
}
{
  const s=await shell({files:{[base+'evil;exit.txt']:'safe',[base+'line\nbreak.txt']:'safe',[base+'a.txt']:'safe'}});
  s.text('cd /shared/glob');
  assert.equal(s.text('ls *.txt'),'a.txt\nevil;exit.txt\nline\\x0Abreak.txt\nmaia> ');
  assert.equal(s.text('echo alive'),'alive\nmaia> ');s.finish();
}
{
  const files={};for(let i=0;i<512;i++)files['/shared/many/a'+i]='x';const s=await shell({files});
  s.send('echo /shared/many/z*');s.step();
  // The approved explicit DFS retains parent snapshots while scanning a child.
  const activeDirectories=['/','/shared','/shared/many'];
  assert.deepEqual(s.openedPaths,activeDirectories);
  assert.equal(s.vfs.openHandleCount,activeDirectories.length);
  s.broker.closeProcess(2);for(let i=0;i<200&&s.exit===null;i++)s.step();
  assert.equal(s.exit,1);assert.equal(s.vfs.openHandleCount,0);assert.equal(s.broker.stats.pipes,0);assert.equal(s.broker.stats.endpoints,0);
}
{
  const s=await shell({files:{'/shared/end/b.txt':'b','/shared/end/a.txt':'a'}});
  s.send('echo /shared/end/*.txt',false);s.broker.close(2,3);const chunks=[];
  for(let i=0;i<100;i++){s.step();const bytes=s.receive();if(bytes instanceof Uint8Array)chunks.push(Buffer.from(bytes));}
  assert.equal(Buffer.concat(chunks).toString(),'/shared/end/a.txt /shared/end/b.txt\n');
  assert.equal(s.exit,0);assert.equal(s.vfs.openHandleCount,0);s.stable();s.broker.closeProcess(2);
  assert.equal(s.broker.stats.pipes,0);assert.equal(s.broker.stats.endpoints,0);
}
console.log('Actual shell glob WASM passed: quote masks, Unicode, sorted expansion, multi-operand file/directory ls, no partial argv on limits, private homes, terminal escaping, cooperative traversal and cleanup.');
