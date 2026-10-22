// Native sanitizer oracle for the same C++98 kernel policy used by kernel.wasm.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import {encodePipelinePlan} from '../runtime/maia-kernel-processes.js';
const directory=await mkdtemp(path.join(os.tmpdir(),'maia-kernel-policy-'));
try {
 const header=fileURLToPath(new URL('../apps/kernel/processes.hpp',import.meta.url));const seed=encodePipelinePlan([['cat','/shared/a'],['cat']]),output=encodePipelinePlan([['cat','/shared/a'],['cat']],{output:true});
 const source=`#include <stdint.h>\n#include "${header}"\n#include <assert.h>
static int reserve(const char* name,int role,int io,unsigned int mask){unsigned int len=0;while(name[len])++len;for(unsigned int i=0;i<32+len;++i)gKernelBuffer[i]=0;kpWrite(gKernelBuffer,0,1);kpWrite(gKernelBuffer,4,role);kpWrite(gKernelBuffer,8,32);kpWrite(gKernelBuffer,12,4);kpWrite(gKernelBuffer,16,mask);kpWrite(gKernelBuffer,20,io);kpWrite(gKernelBuffer,24,len);for(unsigned int i=0;i<len;++i)gKernelBuffer[32+i]=name[i];return maia_kernel_boot_reserve(role,32+len);}
static const uint8_t seed[]={${[...seed].join(',')}};
static const uint8_t output[]={${[...output].join(',')}};
static void outputReset(){for(unsigned int i=0;i<sizeof(output);++i)gKernelBuffer[i]=output[i];}
static void reset(){for(unsigned int i=0;i<sizeof(seed);++i)gKernelBuffer[i]=seed[i];}
static void drain(){int count=0;while(maia_kernel_next_action()){assert(++count<=64);assert(maia_kernel_action_result(kpRead(gKernelBuffer,8),0)==0);}}
int main(){assert(reserve("org.maiaos.kernel",0,0,0)==1);assert(maia_kernel_boot_ready(1,0)==0);int io=reserve("org.maiaplatform.io",1,0,0);int parent=reserve("org.maiaplatform.shell",2,io,1999);assert(parent>0);drain();assert(maia_kernel_boot_ready(io,0)==0);assert(maia_kernel_boot_ready(parent,0)==0);
for(unsigned int i=0;i<4096;++i){reset();kpWrite(gKernelBuffer,32,0xffffffffU-i);assert(maia_kernel_pipeline_start(parent,sizeof(seed))==-1);}
for(int repeat=0;repeat<100;++repeat){reset();int group=maia_kernel_pipeline_start(parent,sizeof(seed));assert(group>0);int children[4],count=0,actions=0;
while(maia_kernel_next_action()){assert(++actions<=64);if(kpRead(gKernelBuffer,4)==3)children[count++]=kpRead(gKernelBuffer,16);assert(maia_kernel_action_result(kpRead(gKernelBuffer,8),0)==0);}assert(count==2);for(int i=0;i<count;++i)assert(maia_kernel_process_exit(children[i],0,0)==0);assert(maia_kernel_pipeline_wait(parent,group,48)==32);assert(kpRead(gKernelBuffer,12)==0);}
for(unsigned int i=0;i<4096;++i){outputReset();kpWrite(gKernelBuffer,40,0xffffffffU-i);assert(maia_kernel_pipeline_start(parent,sizeof(output))==-1);}
for(int repeat=0;repeat<100;++repeat){outputReset();int group=maia_kernel_pipeline_start(parent,sizeof(output));assert(group>0);assert(gProcesses[kpProc(parent)].state==3);drain();assert(gProcesses[kpProc(parent)].state==2);outputReset();assert(maia_kernel_pipeline_start(parent,sizeof(output))==-4);
if(repeat%2){assert(maia_kernel_pipeline_cancel(io,group)==-3);assert(maia_kernel_pipeline_cancel(parent,group)==0);assert(maia_kernel_pipeline_cancel(parent,group)==0);drain();}
else {int index=kpGroup(group);for(int j=0;j<gGroups[index].count;++j)assert(maia_kernel_process_exit(gGroups[index].children[j],0,0)==0);assert(maia_kernel_pipeline_wait(parent,group,16)==-4);assert(maia_kernel_next_action()==0);assert(maia_kernel_pipeline_wait(parent,group,48)==-6);drain();}
assert(maia_kernel_pipeline_wait(parent,group,48)==32);assert(kpRead(gKernelBuffer,12)==static_cast<unsigned int>(repeat%2));assert(maia_kernel_pipeline_cancel(parent,group)==-7);}
return 0;}
`;
 const input=path.join(directory,'policy.cpp'),binary=path.join(directory,'policy');await writeFile(input,source);
 execFileSync(process.env.CXX||'clang++',['-std=c++98','-pedantic-errors','-fsanitize=address,undefined','-fno-omit-frame-pointer',input,'-o',binary],{stdio:'pipe'});
 execFileSync(binary,[],{stdio:'pipe',timeout:30000});console.log('PASS native C++98 ASan/UBSan kernel policy: 8192 malformed packets, 100 v1 + 100 v2/cancel lifecycles, no sanitizer errors');
}finally{await rm(directory,{recursive:true,force:true});}
