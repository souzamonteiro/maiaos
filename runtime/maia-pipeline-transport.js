// Executes kernel actions. No shell syntax, process IDs or scheduler policy here.
export class KernelPipelineTransport {
 constructor({controller,streams,spawn,stop,pipeCapacity=4096}){
  if(!Number.isInteger(pipeCapacity)||pipeCapacity<1||pipeCapacity>4096)throw new TypeError('Invalid pipe capacity');
  this.controller=controller;this.streams=streams;this.spawn=spawn;this.stop=stop;this.pipeCapacity=pipeCapacity;this.owners=new Map();this.inFlight=null;
 }
 start(pid,packet,context){const group=this.controller.start(pid,packet);if(group>0)this.owners.set(group,{pid,context});return group;}
 wait(pid,group,capacity){const result=this.controller.wait(pid,group,capacity);if(result instanceof Uint8Array)this.owners.delete(group);return result;}
 pump(){
  if(this.inFlight)return this.inFlight;
  this.inFlight=this.execute().finally(()=>{this.inFlight=null;});return this.inFlight;
 }
 async execute(){
  for(let budget=0;budget<256;budget++){
   const a=this.controller.action();if(!a){for(const [id,owner] of this.owners)if(owner.context.stopped)this.owners.delete(id);return;}
   const data=new DataView(a.payload.buffer,a.payload.byteOffset,a.payload.byteLength);let result=0;
   try{
    if(a.version!==1)throw new Error('Unsupported kernel action');
    if(a.kind===1){this.streams.connect({reader:{processId:a.pid,handle:a.arg0},writer:{processId:a.arg1,handle:data.getUint32(0,true)},capacity:Math.min(this.pipeCapacity,data.getUint32(4,true))});}
    else if(a.kind===2)this.streams.delegate(a.arg1,data.getUint32(0,true),a.pid,a.arg0);
    else if(a.kind===3){const owner=this.owners.get(a.group);if(!owner)throw new Error('Missing submitted group transport context');await this.spawn(a,owner.context);}
    else if(a.kind===4)await this.stop(a.pid,a.arg0);
    else if(a.kind===5)this.streams.close(a.pid,a.arg0);
    else if(a.kind===6)this.streams.connectEof({processId:a.pid,handle:a.arg0},Math.min(a.arg1,this.pipeCapacity));
    else throw new Error('Unsupported kernel action kind');
   }catch(error){result=-4;this.lastError=error;}
   if(this.controller.acknowledge(a.id,result)!==0)throw new Error('Kernel rejected action completion');
  }
  throw new Error('Kernel transport exceeded bounded action batch');
 }
}
