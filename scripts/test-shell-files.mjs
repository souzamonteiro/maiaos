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
const forbidden=()=>{throw new Error('Read-only shell must not invoke graphics');};
const graphics=Object.fromEntries(['windowCreate','labelCreate','labelSetText','buttonCreate','objectDestroy'].map(name=>[name,forbidden]));
async function shell({files={},capacity=31}={}) {
  const broker=new MaiaStreamBroker();
  broker.connect({reader:{processId:3,handle:0},writer:{processId:2,handle:3},capacity:256});
  broker.connect({reader:{processId:2,handle:4},writer:{processId:3,handle:1},capacity});
  broker.alias(3,1,2);broker.alias(2,4,5);
  const vfs=new MemoryVfsAdapter({appId:manifest.id,maxOpenFiles:manifest.limits.openFiles,files});
  vfs.write=()=>{throw new Error('cat must never write VFS files');};
  let exit=null,steps=0;
  const host=createMaiaHostImports({vfs,graphics,streams:broker,processId:3,onProcessExit:code=>{exit=code;}});
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
}
{
  const s=await shell({files:{'/shared/folder/note.txt':'shared\n','/shared/folder/é file.txt':'Unicode path\n',
    '/home/org.maiaplatform.shell/own.txt':'private own\n','/home/another/secret.txt':'NEVER EXPOSE',
    '/shared/empty':'','/shared/no-newline':'last line','/shared/-name':'dash\n'}});
  assert.match(s.text('cat /system//./welcome.txt'),/^C\+\+ kernel/);
  assert.equal(s.text('cd /shared/folder'),'maia> ');
  assert.equal(s.text('cat note.txt'),'shared\nmaia> ');
  assert.equal(s.text('cat "é file.txt"'),'Unicode path\nmaia> ');
  assert.equal(s.text('cat ../folder/./note.txt'),'shared\nmaia> ');
  assert.equal(s.text('cat /shared/empty'),'maia> ');
  assert.equal(s.text('cat /shared/no-newline'),'last linemaia> ');
  for(const source of ['cat','cat -','cat -n','cat -name'])assert.equal(s.text(source),'usage: cat <file> [file ...]\nmaia> ');
  assert.equal(s.text('cat a b'),'cat: cannot open file\ncat: cannot open file\nmaia> ');
  assert.equal(s.text('cat ""'),'cat: invalid path\nmaia> ');
  for(const source of ['cat absent','cat /shared/folder'])assert.equal(s.text(source),'cat: cannot open file\nmaia> ');
  assert.equal(s.text('cd ..'),'maia> ');assert.equal(s.text('cat ./-name'),'dash\nmaia> ');
  assert.equal(s.text('cd'),'maia> ');assert.equal(s.text('cat own.txt'),'private own\nmaia> ');
  assert.equal(s.text('cat ../another/secret.txt'),'cat: permission denied\nmaia> ');
  assert.equal(s.text('pwd'),'/home/org.maiaplatform.shell\nmaia> ');
  const held=[];for(let i=0;i<4;++i)held.push(s.vfs.open('/shared/empty',VFS_FLAGS.READ));
  assert.ok(held.every(handle=>handle>0));assert.equal(s.text('cat own.txt'),'cat: open-file limit exceeded\nmaia> ');
  for(const handle of held)s.vfs.close(handle);
  for(let i=0;i<1000;++i)assert.equal(s.text('cat own.txt'),'private own\nmaia> ');
  assert.equal(new TextDecoder().decode(s.vfs.files.get('/home/another/secret.txt')),'NEVER EXPOSE');
  s.stable();s.finish();
}
{
  const data=Uint8Array.from({length:131072},(_,index)=>index%256);
  const s=await shell({files:{'/shared/data.bin':data}});const before=s.vfs.files.get('/shared/data.bin').slice();
  assert.deepEqual(s.run('cat /shared/data.bin'),Buffer.concat([Buffer.from(data),prompt]));
  assert.deepEqual(s.vfs.files.get('/shared/data.bin'),before);assert.ok(s.steps>1000);s.stable();s.finish();
}
{
  // A file ending with prompt bytes must not prematurely end the transport fixture.
  const s=await shell({files:{'/tmp/prompt':'x'.repeat(31)+'maia> '}});
  assert.equal(s.text('cat /tmp/prompt'),'x'.repeat(31)+'maia> maia> ');s.finish();
}
{
  const s=await shell({files:{'/tmp/read-error':'x'.repeat(300)}});let reads=0;const original=s.vfs.read.bind(s.vfs);
  s.vfs.read=(handle,count)=>++reads===2?-3:original(handle,count);
  assert.equal(s.text('cat /tmp/read-error'),'x'.repeat(128)+'cat: read failed\nmaia> ');
  assert.equal(s.vfs.openHandleCount,0);s.finish();
}
{
  const s=await shell({files:{'/tmp/slow':'x'.repeat(4096)}});s.send('cat /tmp/slow');s.step();
  assert.equal(s.vfs.openHandleCount,1);for(let tick=0;tick<100;++tick)s.step();
  assert.equal(s.exit,null);assert.equal(s.broker.stats.bufferedBytes,31);s.stable();
  assert.equal(s.untilPrompt().toString(),'x'.repeat(4096)+'maia> ');s.finish();
}
{
  const s=await shell({files:{'/tmp/closed':'x'.repeat(4096),'/tmp/never':'NEVER'}});
  const paths=[],open=s.vfs.open.bind(s.vfs);s.vfs.open=(path,flags)=>{paths.push(path);return open(path,flags);};
  s.send('cat /tmp/closed /tmp/never');s.step();
  assert.equal(s.vfs.openHandleCount,1);s.broker.closeProcess(2);s.step();
  assert.equal(s.exit,1);assert.equal(s.vfs.openHandleCount,0);assert.equal(s.broker.stats.pipes,0);
  assert.deepEqual(paths,['/tmp/closed'],'Closed peer prevents subsequent operands from opening');s.stable();
}
{
  const data=Buffer.from([0,0xff,0xe2,0x82,0xac,10]);const s=await shell({files:{'/tmp/eof':data}});
  s.send('cat /tmp/eof',false);s.broker.close(2,3);const chunks=[];
  for(let tick=0;tick<20;++tick){s.step();const bytes=s.receive();if(bytes instanceof Uint8Array)chunks.push(Buffer.from(bytes));}
  assert.equal(s.exit,0);assert.deepEqual(Buffer.concat(chunks),data);assert.equal(s.vfs.openHandleCount,0);
  s.broker.closeProcess(2);assert.equal(s.broker.stats.pipes,0);s.stable();
}
{
  const segments=['shared',...Array(11).fill('a'.repeat(90)),'b'.repeat(14)];const dir='/'+segments.join('/');assert.equal(dir.length,1023);
  const s=await shell({files:{[dir+'/file']:''}});for(const segment of segments)assert.equal(s.text('cd '+segment),'maia> ');
  assert.equal(s.text('cat file'),'cat: invalid path\nmaia> ');assert.equal(s.text('pwd'),dir+'\nmaia> ');s.finish();
}
{
  const s=await shell({files:{'/shared/multi/b.txt':'B','/shared/multi/a.txt':'A',
    '/shared/multi/é file.txt':'UTF8','/shared/multi/empty':'',
    '/home/another/private':'NEVER','/shared/multi/next':'NEXT'}});
  s.text('cd /shared/multi');
  let peak=0,opens=0;const open=s.vfs.open.bind(s.vfs);
  s.vfs.open=(...args)=>{const handle=open(...args);++opens;peak=Math.max(peak,s.vfs.openHandleCount);return handle;};
  assert.equal(s.text('cat b.txt a.txt b.txt'),'BABmaia> ');
  assert.equal(s.text('cat [ab].txt'),'ABmaia> ');
  assert.equal(s.text('cat empty a.txt "é file.txt"'),'AUTF8maia> ');
  assert.equal(s.text('cat a.txt missing b.txt'),'Acat: cannot open file\nBmaia> ');
  assert.equal(s.text('cat a.txt /home/another/private b.txt'),'Acat: permission denied\nBmaia> ');
  assert.equal(s.text('cat a.txt "" b.txt'),'Acat: invalid path\nBmaia> ');
  const before=opens;
  assert.equal(s.text('cat a.txt -n b.txt'),'usage: cat <file> [file ...]\nmaia> ');
  assert.equal(opens,before,'Invalid options reject argv before opening any file');
  for(let i=0;i<200;++i)assert.equal(s.text('cat a.txt b.txt'),'ABmaia> ');
  assert.equal(peak,1,'Concatenation keeps at most one file open');s.stable();s.finish();
}
{
  const a=Uint8Array.from({length:65536},(_,i)=>i%256),b=Uint8Array.from([0xff,0,10,0xe2,0x82,0xac]);
  const s=await shell({files:{'/tmp/a':a,'/tmp/b':b}});
  assert.deepEqual(s.run('cat /tmp/a /tmp/b /tmp/a'),Buffer.concat([Buffer.from(a),Buffer.from(b),Buffer.from(a),prompt]));
  s.stable();s.finish();
}
{
  const s=await shell({files:{'/tmp/first':'x'.repeat(300),'/tmp/second':'SECOND'}});
  let reads=0;const read=s.vfs.read.bind(s.vfs);
  s.vfs.read=(handle,count)=>++reads===2?-3:read(handle,count);
  assert.equal(s.text('cat /tmp/first /tmp/second'),'x'.repeat(128)+'cat: read failed\nSECONDmaia> ');
  assert.equal(s.vfs.openHandleCount,0);s.finish();
}
{
  const s=await shell({files:{'/tmp/a':'A','/tmp/b':'B'}});
  s.send('cat /tmp/a /tmp/b',false);s.broker.close(2,3);const chunks=[];
  for(let tick=0;tick<40;++tick){s.step();const bytes=s.receive();if(bytes instanceof Uint8Array)chunks.push(Buffer.from(bytes));}
  assert.equal(s.exit,0);assert.equal(Buffer.concat(chunks).toString(),'AB');
  assert.equal(s.vfs.openHandleCount,0);s.broker.closeProcess(2);s.stable();
}
console.log('Actual read-only cat WASM passed: multiple operands/glob order/continued errors/one open file, relative/absolute/quoted Unicode paths, home isolation, exact 128KiB binary output through a 31-byte ring, usage/errors/quotas, 1000 reads, backpressure, closed peer, EOF and stable stack/memory.');
