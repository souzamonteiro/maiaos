// Trusted-host packet transport. Decisions and identities come from kernel.wasm.
const encoder=new TextEncoder();
const capabilities=['vfs.open','vfs.read','vfs.write','vfs.close','vfs.opendir','vfs.readdir','process.pipeline','stream.read','stream.write','stream.close','process.exit'];
export function processResourceMask(manifest){
 let mask=0;for(const cap of manifest.capabilities){const bit=capabilities.indexOf(cap);if(bit>=0)mask|=1<<bit;if(cap.startsWith('gfx.'))mask|=1<<11;if(cap==='events.poll')mask|=1<<12;}return mask;
}
export function encodePipelinePlan(stages){
 const words=stages.flat(), encoded=words.map(word=>encoder.encode(word));
 const start=16+stages.length*8+words.length*8;
 const packet=new Uint8Array(start+encoded.reduce((sum,b)=>sum+b.length,0)),v=new DataView(packet.buffer);
 v.setUint32(0,1,true);v.setUint32(4,stages.length,true);v.setUint32(8,words.length,true);v.setUint32(12,packet.length-start,true);
 let first=0;stages.forEach((stage,i)=>{v.setUint32(16+i*8,first,true);v.setUint32(20+i*8,stage.length,true);first+=stage.length;});
 let offset=start;encoded.forEach((word,i)=>{v.setUint32(16+stages.length*8+i*8,offset,true);v.setUint32(20+stages.length*8+i*8,word.length,true);packet.set(word,offset);offset+=word.length;});return packet;
}
export class KernelProcessController {
 constructor(instance){
  this.exports=instance.exports;this.memory=this.exports.memory;
  for(const name of ['buffer_ptr','buffer_capacity','boot_reserve','boot_ready','pipeline_start','pipeline_wait','next_action','action_result','process_exit','next_runnable'])if(typeof this.exports['maia_kernel_'+name]!=='function')throw new TypeError('Missing kernel process export: '+name);
 }
 input(bytes){if(!(bytes instanceof Uint8Array)||bytes.length>this.exports.maia_kernel_buffer_capacity())return false;new Uint8Array(this.memory.buffer,this.exports.maia_kernel_buffer_ptr(),bytes.length).set(bytes);return true;}
 output(length){return new Uint8Array(this.memory.buffer,this.exports.maia_kernel_buffer_ptr(),length).slice();}
 reserve(manifest,role,ioPid=0){const name=encoder.encode(manifest.id);if(name.length>128)return -1;
  const packet=new Uint8Array(32+name.length),v=new DataView(packet.buffer);
  [1,role,manifest.limits?.memoryPages??32,manifest.limits?.openFiles??16,processResourceMask(manifest),ioPid,name.length,0].forEach((n,i)=>v.setUint32(i*4,n,true));packet.set(name,32);
  this.input(packet);return this.exports.maia_kernel_boot_reserve(role,packet.length);
 }
 ready(pid,status=0){return this.exports.maia_kernel_boot_ready(pid,status);}
 start(caller,packet){if(!this.input(packet))return -1;return this.exports.maia_kernel_pipeline_start(caller,packet.length);}
 wait(caller,group,capacity){const n=this.exports.maia_kernel_pipeline_wait(caller,group,capacity);return n<0?n:this.output(n);}
 action(){const n=this.exports.maia_kernel_next_action();if(!n)return null;const bytes=this.output(n),v=new DataView(bytes.buffer);return {version:v.getUint32(0,true),kind:v.getUint32(4,true),id:v.getUint32(8,true),group:v.getUint32(12,true),pid:v.getUint32(16,true),arg0:v.getUint32(20,true),arg1:v.getUint32(24,true),payload:bytes.slice(32)};}
 acknowledge(id,status=0){return this.exports.maia_kernel_action_result(id,status);}
 exit(pid,status=0,trapped=false){return this.exports.maia_kernel_process_exit(pid,status,trapped?1:0);}
 next(){return this.exports.maia_kernel_next_runnable();}
}
