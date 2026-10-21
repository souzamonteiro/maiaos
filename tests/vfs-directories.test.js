import assert from 'node:assert/strict';
import test from 'node:test';
import {MemoryVfsAdapter, IndexedDbVfsAdapter, VFS_FLAGS} from '../runtime/maia-vfs.js';
import {createMaiaHostImports} from '../runtime/maia-host-imports.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});
function entries(vfs, path) {
  const fd = vfs.opendir(path); assert.ok(fd > 0, `${path}: ${fd}`);
  const output = [];
  for (;;) {
    const packet = vfs.readdir(fd, 271); assert.ok(packet instanceof Uint8Array);
    if (!packet.length) break;
    const header = new DataView(packet.buffer, packet.byteOffset, packet.length);
    assert.equal(header.getUint32(0, true), 1);
    assert.equal(header.getUint32(12, true), 0);
    assert.equal(packet.length, 16 + header.getUint32(8, true));
    output.push([decoder.decode(packet.subarray(16)), header.getUint32(4, true)]);
  }
  assert.equal(vfs.close(fd), 0); return output;
}

test('directory roots, empty mounts, normalized paths and private home', () => {
  const v = new MemoryVfsAdapter({appId: 'one', files: {'/home/two/private/x': 'secret'}});
  assert.deepEqual(entries(v, '/'), [['apps',2],['home',2],['shared',2],['system',2],['tmp',2]]);
  assert.deepEqual(entries(v, '/home'), [['one',2]]);
  assert.deepEqual(entries(v, '/home/one'), []);
  assert.deepEqual(entries(v, '/apps'), []);
  assert.deepEqual(entries(v, '/system//./'), [['welcome.txt',1]]);
  for (const path of ['/home/two', '/home/two/private', '/home/missing']) assert.equal(v.opendir(path), -3);
  for (const path of ['/tmp/missing', '/missing']) assert.equal(v.opendir(path), -2);
  for (const path of ['', '/../../system', '/tmp/\0x', 'relative', '/'+ 'x'.repeat(1023), '/tmp/\ud800']) assert.equal(v.opendir(path), -1);
  assert.equal(v.openHandleCount, 0);
});

test('immediate children sort by UTF-8 bytes and snapshots survive mutations', () => {
  const v = new MemoryVfsAdapter({files: {
    '/shared/z': '', '/shared/.hidden': '', '/shared/deep/inside/file': '',
    '/shared/é': '', '/shared/\ue000': '', '/shared/\u{10000}': '', '/shared/\ufeffbom': '',
  }});
  const fd = v.opendir('/shared');
  const created = v.open('/shared/after', VFS_FLAGS.WRITE | VFS_FLAGS.CREATE); v.close(created);
  const names = [];
  for (;;) {const packet = v.readdir(fd,271); if (!packet.length) break; names.push(decoder.decode(packet.subarray(16)));}
  assert.deepEqual(names, ['.hidden','deep','z','é','\ue000','\ufeffbom','\u{10000}']);
  v.close(fd);
  assert.deepEqual(entries(v, '/shared/deep'), [['inside',2]]);
  assert.ok(entries(v, '/shared').some(([name]) => name === 'after'));
});

test('directory packets are exact, atomic and independent of caller mutation', () => {
  const v = new MemoryVfsAdapter(); const fd = v.opendir('/system');
  assert.equal(v.readdir(fd, 26), -4);
  for (const capacity of [0,15,4097,-1,1.5]) assert.equal(v.readdir(fd, capacity), -1);
  const expected = new Uint8Array([1,0,0,0,1,0,0,0,11,0,0,0,0,0,0,0,...encoder.encode('welcome.txt')]);
  const packet = v.readdir(fd, 27); assert.deepEqual(packet, expected); packet.fill(0);
  assert.equal(v.readdir(fd, 16).length, 0);
  assert.equal(v.readdir(fd, 16).length, 0); assert.equal(v.close(fd), 0); assert.equal(v.close(fd), -7);
  assert.deepEqual(v.readdir(v.opendir('/system'),27), expected); v.closeAll();
});

test('file and directory handles share quotas and reject wrong operations', () => {
  const v = new MemoryVfsAdapter({maxOpenFiles: 1}); const fd = v.opendir('/system');
  assert.equal(v.open('/system/welcome.txt',1), -4); assert.equal(v.opendir('/tmp'), -4);
  assert.equal(v.read(fd,10), -1); assert.equal(v.write(fd,encoder.encode('x')), -1);
  v.close(fd); const file = v.open('/system/welcome.txt',1); assert.equal(v.readdir(file,271),-1);
  assert.equal(v.readdir(999,271),-7); v.closeAll(); assert.equal(v.openHandleCount,0);
  for (let i = 0; i < 1000; ++i) { const h=v.opendir('/system'); assert.ok(h>0); v.close(h); }
  assert.equal(v.openHandleCount,0);
  assert.equal(new MemoryVfsAdapter({maxOpenFiles:0}).opendir('/'),-4);
});

test('file targets and ambiguous file/ancestor namespaces are rejected atomically', () => {
  const v = new MemoryVfsAdapter({files:{'/shared/a':'file','/shared/a/b':'child'}});
  for (const path of ['/system/welcome.txt','/shared/a','/shared/a/b','/shared']) assert.equal(v.opendir(path),-9);
  assert.equal(v.openHandleCount,0);
  assert.equal(v.files.get('/shared/a/b').length,5);
});

test('directory snapshot entry/name/byte limits fail before allocating handles', () => {
  const many = {}; for (let i=0;i<1025;++i) many[`/tmp/n${i}`]='';
  const v = new MemoryVfsAdapter({files:many}); assert.equal(v.opendir('/tmp'),-4); assert.equal(v.openHandleCount,0);
  const names = new MemoryVfsAdapter({files:{['/tmp/'+'x'.repeat(256)]:''}}); assert.equal(names.opendir('/tmp'),-4);
  const boundary = new MemoryVfsAdapter({files:{['/tmp/'+'é'.repeat(127)+'x']:''}});
  assert.equal(boundary.readdir(boundary.opendir('/tmp'),271).length,271);
  const long = {};for (let i=0;i<300;++i) long['/tmp/'+String(i).padStart(3,'0')+'x'.repeat(240)]='';
  const bytes = new MemoryVfsAdapter({files:long}); assert.equal(bytes.opendir('/tmp'),-4); assert.equal(bytes.openHandleCount,0);
  const malformed = new MemoryVfsAdapter({files:{'/tmp/\ud800':''}}); assert.equal(malformed.opendir('/tmp'),-1);
});

test('directory imports check full memory ranges before opening or consuming entries', () => {
  const vfs = new MemoryVfsAdapter(); const never = () => {throw new Error('unexpected graphics');};
  const host = createMaiaHostImports({vfs, graphics:Object.fromEntries(['windowCreate','labelCreate','labelSetText','buttonCreate','objectDestroy'].map(n=>[n,never]))});
  const legacy = createMaiaHostImports({graphics: Object.fromEntries(['windowCreate','labelCreate','labelSetText','buttonCreate','objectDestroy'].map(n=>[n,never])),
    vfs: Object.fromEntries(['open','read','write','close'].map(name => [name,vfs[name].bind(vfs)]))});
  assert.equal(legacy.imports['maia.vfs'].opendir, undefined);
  assert.equal(legacy.imports['maia.vfs'].readdir, undefined);
  const memory = new WebAssembly.Memory({initial:1}); host.attachMemory(memory);
  const api = host.imports['maia.vfs']; new Uint8Array(memory.buffer).set(encoder.encode('/system'),32);
  for (const [pointer,length] of [[65535,7],[-1,7],[32,0],[32,1024]]) assert.equal(api.opendir(pointer,length),-1);
  new Uint8Array(memory.buffer).set([0xff,0x2f],64);assert.equal(api.opendir(64,2),-1);
  new Uint8Array(memory.buffer).set([0xef,0xbb,0xbf,0x2f],64);assert.equal(api.opendir(64,4),-1);
  assert.equal(vfs.openHandleCount,0);const h=api.opendir(32,7);assert.ok(h>0);
  const view=new Uint8Array(memory.buffer);view.fill(0xcc,127,160);
  for (const [pointer,capacity] of [[65530,27],[-1,27],[128,15],[128,4097]]) assert.equal(api.readdir(h,pointer,capacity),-1);
  assert.equal(api.readdir(h,128,26),-4); assert.ok(view.slice(127,160).every(byte=>byte===0xcc));
  memory.grow(1); const grown=new Uint8Array(memory.buffer);grown.fill(0xcc,69999,70029);
  assert.equal(api.readdir(h,70000,27),27);assert.equal(grown[69999],0xcc);assert.equal(grown[70027],0xcc);
  assert.equal(decoder.decode(grown.slice(70016,70027)),'welcome.txt');
  host.imports['maia.process'].exit(0);assert.equal(vfs.openHandleCount,0);
  vfs.opendir('/tmp');host.closeFiles();host.closeFiles();assert.equal(vfs.openHandleCount,0);
});

test('IndexedDB-hydrated adapter exposes the same private directory view and quota', async () => {
  const records=[{path:'/home/one/docs/note',bytes:encoder.encode('own')},{path:'/home/two/private',bytes:encoder.encode('other')},{path:'/shared/public/x',bytes:encoder.encode('shared')}];
  // Storage fixture only: the real adapter performs hydration, filtering and enumeration.
  const database={transaction(){return {objectStore(){return {getAll(){const req={};queueMicrotask(()=>{req.result=records;req.onsuccess();});return req;}};}};}};
  const v = new IndexedDbVfsAdapter(database,()=>{},'one',1);await v.hydrate();
  assert.deepEqual(entries(v,'/home'),[['one',2]]);assert.deepEqual(entries(v,'/home/one'),[['docs',2]]);
  assert.deepEqual(entries(v,'/shared'),[['public',2]]);assert.equal(v.opendir('/home/two'),-3);
  const fd=v.opendir('/');assert.equal(v.opendir('/tmp'),-4);v.close(fd);
});
