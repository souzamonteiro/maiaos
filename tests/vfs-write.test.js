import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryVfsAdapter,IndexedDbVfsAdapter,VFS_FLAGS as F} from '../runtime/maia-vfs.js';
import {MaiaVfsStore,VFS_LIMITS as L} from '../runtime/maia-vfs-store.js';
import {createMaiaHostImports} from '../runtime/maia-host-imports.js';
const bytes=s=>new TextEncoder().encode(s), text=b=>new TextDecoder().decode(b);
test('append selects shared current EOF and preserves reader positions and private handles',()=>{
 const store=new MaiaVfsStore(),a=new MemoryVfsAdapter({store,appId:'one'}),b=new MemoryVfsAdapter({store,appId:'two'});
 const x=a.open('/shared/a',F.WRITE|F.CREATE|F.APPEND),y=b.open('/shared/a',F.WRITE|F.APPEND);
 const read=a.open('/shared/a',F.READ);
 assert.equal(a.write(x,bytes('A')),1);assert.equal(b.write(y,bytes('B')),1);assert.equal(text(a.read(read,1)),'A');
 assert.equal(a.write(x,bytes('C')),1);assert.equal(text(a.read(read,9)),'BC');
 assert.equal(b.close(y),0);assert.equal(a.write(x,bytes('D')),1);
 const privateFd=a.open('/home/one/private',14);assert.ok(privateFd>0);
 assert.equal(b.open('/home/one/private',1),-3);assert.equal(b.open('/home/two/../one/private',22),-3);
 const dir=b.opendir('/home');assert.ok(dir>0);const entry=b.readdir(dir,4096);assert.equal(text(entry.slice(16)),'two');assert.equal(b.readdir(dir,4096).length,0);
 b.closeAll();assert.equal(a.write(x,bytes('E')),1);
});
test('write flags, directory conflicts and zero writes have no unintended mutation',()=>{
 const v=new MemoryVfsAdapter({files:{'/tmp/a':'abc','/tmp/dir/leaf':'x'}});
 for(const flags of [16,17,30,0,32,4294967297])assert.equal(v.open('/tmp/new',flags),-1);
 for(const name of ['/','/home','/home/default','/tmp','/tmp/dir'])assert.equal(v.open(name,14),-1);
 assert.equal(v.open('/tmp/a/child',14),-9);
 assert.equal(text(v.files.get('/tmp/a')),'abc');assert.equal(v.files.has('/tmp/new'),false);
 const fd=v.open('/tmp/a',22);assert.equal(v.write(fd,new Uint8Array(0)),0);assert.equal(v.handles.get(fd).position,0);
 const source=bytes('z');assert.equal(v.write(fd,source),1);source[0]=0;assert.equal(text(v.files.get('/tmp/a')),'abcz');
 assert.equal(v.write(fd,new Uint8Array(4097)),-1);assert.equal(v.handles.get(fd).position,4);
});
test('file, store and record quotas fail atomically and truncation recovers oversized hydration',()=>{
 const store=new MaiaVfsStore(),v=new MemoryVfsAdapter({store});
 for(let i=0;i<8;i++)store.files.set('/tmp/f'+i,new Uint8Array(L.fileBytes));
 const fd=v.open('/tmp/f0',18),before=v.files.get('/tmp/f0');
 assert.equal(v.write(fd,bytes('x')),-4);assert.equal(v.files.get('/tmp/f0'),before);assert.equal(v.handles.get(fd).position,0);
 const next=v.open('/tmp/new',6);assert.ok(next>0);assert.equal(v.write(next,bytes('x')),-4);assert.equal(v.files.get('/tmp/new').length,0);
 assert.ok(v.open('/tmp/f0',14)>0);assert.equal(v.write(next,bytes('x')),1);
 store.files.set('/tmp/oversize',new Uint8Array(L.fileBytes+1));const over=v.open('/tmp/oversize',2);assert.equal(v.write(over,bytes('x')),-4);assert.ok(v.open('/tmp/oversize',14)>0);
 const full=new MemoryVfsAdapter();for(let i=0;i<L.files;i++)full.files.set('/tmp/'+i,new Uint8Array());
 assert.equal(full.open('/tmp/new',14),-4);assert.equal(full.openHandleCount,0);assert.equal(full.files.has('/tmp/new'),false);
 const noHandles=new MemoryVfsAdapter({maxOpenFiles:0,files:{'/tmp/a':'keep'}});assert.equal(noHandles.open('/tmp/a',14),-4);assert.equal(text(noHandles.files.get('/tmp/a')),'keep');
});
test('write import bounds copies before adapter invocation, including zero bytes',()=>{
 let called=0;const vfs=new MemoryVfsAdapter();vfs.write=()=>{++called;return 0;};const never=()=>{throw new Error('unexpected graphics');};const host=createMaiaHostImports({vfs,graphics:Object.fromEntries(['windowCreate','labelCreate','labelSetText','buttonCreate','objectDestroy'].map(n=>[n,never]))});const memory=new WebAssembly.Memory({initial:1});host.attachInstance({exports:{memory}});
 const write=host.imports['maia.vfs'].write;
 for(const [ptr,count] of [[0,4097],[-1,0],[65535,2],[0,-1]])assert.equal(write(1,ptr,count),-1);
 assert.equal(called,0);assert.equal(write(1,65536,0),0);assert.equal(called,1);
});
// Storage fixture implements transaction completion/failure; real adapters own
// hydration, migration, serialization, permissions and error reporting.
function database(records, fail=false){
 const map=new Map(records.map(r=>[r.path,r]));let reads=0,writes=0;
 return {map,get reads(){return reads;},get writes(){return writes;},transaction(name,mode){const tx={};tx.objectStore=()=>({
 getAll(){reads++;const req={};queueMicrotask(()=>{req.result=[...map.values()];req.onsuccess();});return req;},
 put(record){++writes;if(!fail)map.set(record.path,record);queueMicrotask(()=>{if(fail){tx.error=new Error('disk full');tx.onabort();}else tx.oncomplete();});},
 delete(path){if(!fail)map.delete(path);queueMicrotask(()=>{if(fail){tx.error=new Error("disk full");tx.onabort();}else tx.oncomplete();});},
 });return tx;}};
}
test('shared hydration occurs once, migrates legacy kernel home and serializes append persistence',async()=>{
 const db=database([{path:'/home/old.txt',bytes:bytes('old')},{path:'/home/one/a',bytes:bytes('secret')},{path:'/shared/out',bytes:bytes('start')}]);
 const store=new MaiaVfsStore(),a=new IndexedDbVfsAdapter(db,()=>{},'one',16,store),b=new IndexedDbVfsAdapter(db,()=>{},'two',16,store);
 await Promise.all([a.hydrate(),b.hydrate()]);assert.equal(db.reads,1);assert.equal(db.map.has('/home/old.txt'),false);assert.equal(text(db.map.get('/home/org.maiaos.kernel/old.txt').bytes),'old');assert.equal(b.open('/home/one/a',1),-3);
 const x=a.open('/shared/out',22),y=b.open('/shared/out',22);a.write(x,bytes('A'));b.write(y,bytes('B'));await a.flush();assert.equal(text(db.map.get('/shared/out').bytes),'startAB');
});
test('persistence failures are reported and flush rejects without pretending durability',async()=>{
 const errors=[],db=database([],true),v=new IndexedDbVfsAdapter(db,e=>errors.push(e.message),'one');await v.hydrate();
 const fd=v.open('/shared/new',14);assert.equal(v.write(fd,bytes('accepted')),8);assert.equal(v.close(fd),0);
 await assert.rejects(v.flush(),/disk full/);assert.ok(errors.length>0);assert.equal(text(v.files.get('/shared/new')),'accepted');
});
test('migration preserves an existing modern home record regardless of record order',async()=>{
 for(const reverse of [false,true]){
  const records=[{path:'/home/a',bytes:bytes('old')},{path:'/home/org.maiaos.kernel/a',bytes:bytes('new')}];
  const db=database(reverse?records.reverse():records),v=new IndexedDbVfsAdapter(db,()=>{},'other');await v.hydrate();
  assert.equal(text(db.map.get('/home/org.maiaos.kernel/a').bytes),'new');assert.equal(db.map.has('/home/a'),false);
 }
});

test('tiny writes coalesce without retaining an unbounded snapshot queue; zero writes do not persist',async()=>{
 const db=database([]),v=new IndexedDbVfsAdapter(db,()=>{},'one');await v.hydrate();
 const fd=v.open('/shared/tiny',22);for(let i=0;i<1000;i++)assert.equal(v.write(fd,bytes('x')),1);
 await v.flush();assert.ok(db.writes<=2);assert.equal(db.map.get('/shared/tiny').bytes.length,1000);
 const before=db.writes;assert.equal(v.write(fd,new Uint8Array()),0);v.open('/shared/tiny',18);await v.flush();assert.equal(db.writes,before);
});

test('shared truncate does not rewind a live reader beyond the new EOF',()=>{
 const store=new MaiaVfsStore(),a=new MemoryVfsAdapter({store}),b=new MemoryVfsAdapter({store});
 const writer=a.open('/shared/positions',14);a.write(writer,bytes('ABC'));
 const reader=a.open('/shared/positions',1);assert.equal(text(a.read(reader,2)),'AB');
 const replace=b.open('/shared/positions',14);assert.equal(a.read(reader,1).length,0);assert.equal(a.handles.get(reader).position,2);
 b.write(replace,bytes('XYZ'));assert.equal(text(a.read(reader,9)),'Z');
});
