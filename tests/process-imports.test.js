import test from 'node:test';import assert from 'node:assert/strict';
import {createMaiaHostImports} from '../runtime/maia-host-imports.js';
import {MemoryVfsAdapter} from '../runtime/maia-vfs.js';import {MaiaStreamBroker} from '../runtime/maia-streams.js';
const never=()=>{throw new Error('Unexpected graphics');};
const graphics=Object.fromEntries(['windowCreate','labelCreate','labelSetText','buttonCreate','objectDestroy'].map(n=>[n,never]));
test('process imports validate complete memory ranges before kernel invocation/reaping',()=>{
 let starts=0,waits=0;const host=createMaiaHostImports({graphics,vfs:new MemoryVfsAdapter(),pipeline:{start(packet){starts++;assert.equal(packet.length,16);return 7;},wait(){waits++;return new Uint8Array(32).fill(9);}}});
 const memory=new WebAssembly.Memory({initial:1});host.attachMemory(memory);const api=host.imports['maia.process'];
 for(const [ptr,n] of [[65535,16],[-1,16],[0,15],[0,1537]])assert.equal(api.pipeline_start(ptr,n),-1);assert.equal(starts,0);
 assert.equal(api.pipeline_start(0,16),7);assert.equal(starts,1);
 for(const [ptr,n] of [[65535,32],[-1,32],[0,15],[0,49]])assert.equal(api.pipeline_wait(7,ptr,n),-1);assert.equal(waits,0);
 const bytes=new Uint8Array(memory.buffer);bytes.fill(0xcc,63,98);assert.equal(api.pipeline_wait(7,64,32),32);assert.equal(bytes[63],0xcc);assert.equal(bytes[96],0xcc);assert.ok(bytes.slice(64,96).every(n=>n===9));
});
test('worker argv transport copies immutable data atomically and checks capacity',()=>{
 const args=Uint8Array.of(1,2,3),host=createMaiaHostImports({graphics,vfs:new MemoryVfsAdapter(),processArgs:args});args[0]=9;
 const memory=new WebAssembly.Memory({initial:1});host.attachMemory(memory);const api=host.imports['maia.process'],bytes=new Uint8Array(memory.buffer);bytes.fill(0xcc,0,8);
 assert.equal(api.args_size(),3);assert.equal(api.args_copy(0,2),-4);assert.ok(bytes.slice(0,8).every(n=>n===0xcc));assert.equal(api.args_copy(65535,3),-1);
 assert.equal(api.args_copy(1,3),3);assert.deepEqual([...bytes.slice(0,5)],[0xcc,1,2,3,0xcc]);
});
test('privileged cross-process aliases preserve references and bounded EOF readers release their pipe',()=>{
 const b=new MaiaStreamBroker({maxEndpoints:2,maxPipes:2});b.connect({reader:{processId:1,handle:0},writer:{processId:2,handle:1},capacity:3});
 b.delegate(2,1,3,1);b.closeProcess(2);assert.equal(b.read(1,0,1),-6);assert.equal(b.write(3,1,Uint8Array.of(1,2,3,4)),3);
 b.closeProcess(3);assert.deepEqual([...b.read(1,0,3)],[1,2,3]);assert.equal(b.read(1,0,1).length,0);b.closeProcess(1);assert.equal(b.stats.pipes,0);
 b.connectEof({processId:4,handle:0},1);assert.equal(b.read(4,0,1).length,0);assert.throws(()=>b.connectEof({processId:4,handle:0},1));b.closeProcess(4);assert.equal(b.stats.pipes,0);
});
