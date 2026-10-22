#ifndef MAIA_KERNEL_PROCESSES_HPP
#define MAIA_KERNEL_PROCESSES_HPP
// Kernel-owned bounded process/group policy. Host code transports these packets.
// Process states: 0 free, 1 reserved/starting, 2 runnable, 3 blocked, 5 exited.
// Group states: 0 free, 1 starting, 2 running, 3 rolling back, 4 complete.
// Four cursor steps per stage reserve stdin/stdout/stderr, then start the worker.
#define MAIA_KERNEL_EXPORT extern "C" __attribute__((visibility("default")))
struct KernelProcess {
    int pid, role, state, ready, io, paired, bootCursor, aborting;
    unsigned int pages, files, mask, nameLength;
    char name[129];
};
struct KernelGroup {
    int id, owner, state, cursor, failed, count;
    // Track successful binding separately: rollback must not close a collision.
    // Cleanup: 0 not requested, 1 awaiting RELEASE acknowledgement, 2 acknowledged.
    int outputMode, outputBound, outputCleanup;
    int children[4]; int exits[4]; unsigned int started;
    unsigned int planBytes; uint8_t plan[1536];
};
static KernelProcess gProcesses[16];
static KernelGroup gGroups[4];
static uint8_t gKernelBuffer[4096];
static uint8_t gKernelAction[4096];
static int gNextPid = 1, gNextGroup = 1, gNextAction = 1;
static int gActionBytes = 0, gActionGroup = -1, gActionBoot = -1, gActionAbort = 0, gActionState = 0, gActionBootPid = 0;
static unsigned int gRunnableCursor = 0;
static unsigned int kpRead(const uint8_t* data, unsigned int at)
{
    return static_cast<unsigned int>(data[at]) | (static_cast<unsigned int>(data[at+1]) << 8)
        | (static_cast<unsigned int>(data[at+2]) << 16) | (static_cast<unsigned int>(data[at+3]) << 24);
}
static void kpWrite(uint8_t* data, unsigned int at, unsigned int value)
{
    for (unsigned int i=0;i<4;++i) data[at+i]=static_cast<uint8_t>(value >> (i*8));
}
static int kpProc(int pid) { for (int i=0;i<16;++i) if(gProcesses[i].state && gProcesses[i].pid==pid)return i; return -1; }
static int kpGroup(int id) { for(int i=0;i<4;++i)if(gGroups[i].state && gGroups[i].id==id)return i;return -1; }
static int kpName(const KernelProcess* p,const char* name)
{
    unsigned int i=0;while(name[i] && i<p->nameLength){if(name[i]!=p->name[i])return 0;++i;}return !name[i] && i==p->nameLength;
}
static int kpUtf8(const uint8_t* s,unsigned int length)
{
    unsigned int i=0;while(i<length){unsigned int c=s[i++],extra=0,min=0;
        if(!c)return 0;
        if(c<128)continue;
        if(c>=194 && c<=223){c&=31;extra=1;min=128;}
        else if(c>=224 && c<=239){c&=15;extra=2;min=2048;}
        else if(c>=240 && c<=244){c&=7;extra=3;min=65536;}else return 0;
        if(extra>length-i)return 0;
        while(extra){unsigned int b=s[i++];if(b<128 || b>191)return 0;c=(c<<6)|(b&63);--extra;}
        if(c<min || c>1114111 || (c>=55296 && c<=57343))return 0;
    }return 1;
}
static void kpReap(int index)
{
    KernelGroup* g=gGroups+index;
    for(int j=0;j<g->count;++j){int p=kpProc(g->children[j]);if(p>=0)gProcesses[p].state=0;}
    g->state=0;
}
static void kpComplete(int index)
{
    KernelGroup* g=gGroups+index;g->state=4;
    int parent=kpProc(g->owner);
    if(parent>=0 && gProcesses[parent].state==3)gProcesses[parent].state=2;
    else if(parent<0 || gProcesses[parent].state==5)kpReap(index);
}
static void kpRollback(int index)
{
    KernelGroup* g=gGroups+index;if(g->state==3)return;
    if(g->state==4 && !g->outputBound){g->failed=1;return;}
    g->state=3;g->cursor=0;g->failed=1;
    for(int j=0;j<g->count;++j){int p=kpProc(g->children[j]);if(p>=0 && gProcesses[p].state!=5)gProcesses[p].state=1;}
}
static void kpAction(int kind,int group,int pid,int a,int b,unsigned int payload)
{
    kpWrite(gKernelAction,0,1);kpWrite(gKernelAction,4,kind);kpWrite(gKernelAction,8,gNextAction++);
    kpWrite(gKernelAction,12,group);kpWrite(gKernelAction,16,pid);kpWrite(gKernelAction,20,a);
    kpWrite(gKernelAction,24,b);kpWrite(gKernelAction,28,payload);gActionBytes=32+static_cast<int>(payload);
}
static unsigned int kpArgs(KernelGroup* g,int stage)
{
    unsigned int stages=kpRead(g->plan,4),words=kpRead(g->plan,8),base=g->outputMode?24:16;
    unsigned int first=kpRead(g->plan,base+stage*8),count=kpRead(g->plan,base+4+stage*8);
    unsigned int entries=base+stages*8,out=8+count*8;
    kpWrite(gKernelAction,32,1);kpWrite(gKernelAction,36,count);
    for(unsigned int i=0;i<count;++i){unsigned int at=entries+(first+i)*8;
        unsigned int source=kpRead(g->plan,at),len=kpRead(g->plan,at+4);
        kpWrite(gKernelAction,40+i*8,out);kpWrite(gKernelAction,44+i*8,len);
        for(unsigned int j=0;j<len;++j)gKernelAction[32+out+j]=g->plan[source+j];out+=len;
    }
    (void)words;return out;
}
MAIA_KERNEL_EXPORT int maia_kernel_buffer_ptr(void) { return static_cast<int>(reinterpret_cast<uintptr_t>(gKernelBuffer)); }
MAIA_KERNEL_EXPORT int maia_kernel_buffer_capacity(void) { return 4096; }
MAIA_KERNEL_EXPORT int maia_kernel_boot_reserve(int role,int bytes)
{
    if(bytes<33 || bytes>160 || kpRead(gKernelBuffer,0)!=1 || kpRead(gKernelBuffer,4)!=static_cast<unsigned int>(role)
        || role<0 || role>2 || kpRead(gKernelBuffer,28))return -1;
    unsigned int len=kpRead(gKernelBuffer,24),pages=kpRead(gKernelBuffer,8),files=kpRead(gKernelBuffer,12),mask=kpRead(gKernelBuffer,16);
    int io=static_cast<int>(kpRead(gKernelBuffer,20));
    if(!len || len>128 || bytes!=32+static_cast<int>(len) || pages<1 || pages>32 || files>16 || (mask & ~8191U))return -1;
    for(unsigned int i=0;i<len;++i){unsigned int c=gKernelBuffer[32+i];int letter=(c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9');
        if(!letter && (i==0 || (c!='.' && c!='_' && c!='-')))return -1;}
    int slot=-1;for(int i=0;i<16;++i)if(!gProcesses[i].state && slot<0)slot=i;
    if(slot<0 || gNextPid>=2147483647 || gNextAction>2147483500)return -4;
    KernelProcess candidate;candidate.nameLength=len;for(unsigned int i=0;i<len;++i)candidate.name[i]=gKernelBuffer[32+i];candidate.name[len]=0;
    int shell=kpName(&candidate,"org.maiaplatform.shell");
    if((role==0 && (!kpName(&candidate,"org.maiaos.kernel") || gNextPid!=1))
        || (role==1 && !kpName(&candidate,"org.maiaplatform.io")) || ((mask&64) && !shell))return -3;
    int pair=-1;
    if(shell && role==2){pair=kpProc(io);if(pair<0 || gProcesses[pair].role!=1 || gProcesses[pair].paired || gProcesses[pair].aborting)return -3;}
    else if(io)return -1;
    if(role!=0 && gNextPid==1)return -3;
    KernelProcess* p=gProcesses+slot;p->pid=gNextPid++;p->role=role;p->state=1;p->ready=0;p->io=io;p->paired=0;p->bootCursor=0;p->aborting=0;
    p->pages=pages;p->files=files;p->mask=mask;p->nameLength=len;
    for(unsigned int i=0;i<=len;++i)p->name[i]=candidate.name[i];
    if(pair>=0)gProcesses[pair].paired=p->pid;
    return p->pid;
}
MAIA_KERNEL_EXPORT int maia_kernel_boot_ready(int pid,int status)
{
    int i=kpProc(pid);if(i<0)return -7;KernelProcess* p=gProcesses+i;
    if(p->ready || p->state!=1)return -1;
    if(status){p->aborting=1;if(p->io){int io=kpProc(p->io);if(io>=0)gProcesses[io].aborting=1;}return 0;}
    p->ready=1;
    if(p->role!=1 && !p->io)p->state=2;
    if(p->io && p->bootCursor==4){p->state=2;int io=kpProc(p->io);if(io>=0 && gProcesses[io].ready)gProcesses[io].state=2;}
    if(p->role==1 && p->paired){int owner=kpProc(p->paired);if(owner>=0 && gProcesses[owner].bootCursor==4 && gProcesses[owner].ready)p->state=2;}
    return 0;
}
MAIA_KERNEL_EXPORT int maia_kernel_pipeline_start(int caller,int bytes)
{
    int parent=kpProc(caller);if(parent<0)return -3;KernelProcess* owner=gProcesses+parent;
    if(!(owner->mask&64) || !kpName(owner,"org.maiaplatform.shell"))return -3;
    for(int i=0;i<4;++i)if(gGroups[i].state && gGroups[i].owner==caller)return -4;
    if(owner->state!=2)return -3;
    if(bytes<16 || bytes>1536)return -1;
    unsigned int version=kpRead(gKernelBuffer,0),base=16;
    if(version==2){if(bytes<24 || kpRead(gKernelBuffer,16)!=1 || kpRead(gKernelBuffer,20))return -1;base=24;}
    else if(version!=1)return -1;
    if(version==2 && !(owner->mask&4))return -3;
    unsigned int stages=kpRead(gKernelBuffer,4),words=kpRead(gKernelBuffer,8),strings=kpRead(gKernelBuffer,12);
    if(stages<2 || stages>4 || words<stages+1 || words>12)return -1;
    unsigned int start=base+stages*8+words*8;if(start>static_cast<unsigned int>(bytes) || strings!=static_cast<unsigned int>(bytes)-start)return -1;
    unsigned int previous=0;
    for(unsigned int s=0;s<stages;++s){unsigned int first=kpRead(gKernelBuffer,base+s*8),count=kpRead(gKernelBuffer,base+4+s*8);
        if(first!=previous || !count || count>words-first || (!s && count<2))return -1;previous+=count;}
    if(previous!=words)return -1;
    unsigned int position=start;
    for(unsigned int w=0;w<words;++w){unsigned int at=base+stages*8+w*8,offset=kpRead(gKernelBuffer,at),len=kpRead(gKernelBuffer,at+4);
        if(offset!=position || len>95 || len>static_cast<unsigned int>(bytes)-position || !kpUtf8(gKernelBuffer+offset,len))return -1;
        position+=len;}
    if(position!=static_cast<unsigned int>(bytes))return -1;
    for(unsigned int s=0;s<stages;++s){unsigned int first=kpRead(gKernelBuffer,base+s*8),count=kpRead(gKernelBuffer,base+4+s*8),at=base+stages*8+first*8;
        unsigned int offset=kpRead(gKernelBuffer,at);
        if(kpRead(gKernelBuffer,at+4)!=3 || gKernelBuffer[offset]!='c' || gKernelBuffer[offset+1]!='a' || gKernelBuffer[offset+2]!='t')return -1;
        for(unsigned int j=1;j<count;++j){at=base+stages*8+(first+j)*8;offset=kpRead(gKernelBuffer,at);if(kpRead(gKernelBuffer,at+4) && gKernelBuffer[offset]=='-')return -1;}
    }
    // Worker resource requests: open/read/close + streams + exit. args is bootstrap data.
    const unsigned int required=1|2|8|128|256|512|1024;
    if((owner->mask&required)!=required)return -3;
    int group=-1,freeCount=0;unsigned int reserved=0;
    for(int i=0;i<4;++i){if(!gGroups[i].state && group<0)group=i;if(gGroups[i].state)reserved+=gGroups[i].count*32;}
    for(int i=0;i<16;++i)if(!gProcesses[i].state)++freeCount;
    if(group<0 || freeCount<static_cast<int>(stages) || reserved+stages*32>128 || gNextPid>2147483646-static_cast<int>(stages) || gNextGroup>=2147483647 || gNextAction>2147483500)return -4;
    KernelGroup* g=gGroups+group;g->id=gNextGroup++;g->owner=caller;g->state=1;g->cursor=0;g->failed=0;g->count=stages;g->started=0;g->planBytes=bytes;g->outputMode=version==2?1:0;g->outputBound=0;g->outputCleanup=0;
    for(int i=0;i<bytes;++i)g->plan[i]=gKernelBuffer[i];
    for(unsigned int s=0;s<stages;++s){for(int i=0;i<16;++i)if(!gProcesses[i].state){KernelProcess* p=gProcesses+i;p->pid=gNextPid++;p->state=1;p->role=3;p->ready=0;p->bootCursor=0;p->io=0;p->paired=0;p->aborting=0;p->pages=32;p->files=4;p->mask=required;p->nameLength=owner->nameLength;
        for(unsigned int k=0;k<=owner->nameLength;++k)p->name[k]=owner->name[k];g->children[s]=p->pid;g->exits[s]=0;break;}}
    owner->state=3;return g->id;
}
MAIA_KERNEL_EXPORT int maia_kernel_next_action(void)
{
    if(!gActionBytes){
        gActionGroup=-1;gActionBoot=-1;gActionAbort=0;
        for(int i=0;i<16 && !gActionBytes;++i){KernelProcess* p=gProcesses+i;if(!p->state)continue;
            if(p->aborting){kpAction(4,0,p->pid,1,3,0);gActionBoot=i;gActionBootPid=p->pid;gActionAbort=1;break;}
            if(!p->io || p->bootCursor>=4)continue;
            gActionBoot=i;gActionBootPid=p->pid;
            if(p->bootCursor==0){kpAction(1,0,p->pid,0,p->io,8);kpWrite(gKernelAction,32,3);kpWrite(gKernelAction,36,4096);}
            else if(p->bootCursor==1){kpAction(1,0,p->io,4,p->pid,8);kpWrite(gKernelAction,32,1);kpWrite(gKernelAction,36,4096);}
            else if(p->bootCursor==2){kpAction(2,0,p->pid,2,p->pid,4);kpWrite(gKernelAction,32,1);}
            else {kpAction(2,0,p->io,5,p->io,4);kpWrite(gKernelAction,32,4);}
        }
        for(int i=0;i<4 && !gActionBytes;++i){KernelGroup* g=gGroups+i;
            if(g->state!=1 && g->state!=3 && !(g->state==4 && g->outputCleanup==1))continue;
            gActionGroup=i;gActionBoot=-1;gActionState=g->state;
            if(g->state==4){kpAction(5,g->id,g->owner,3,0,0);continue;}
            while(g->cursor<g->count*4 && !gActionBytes){int stage=g->cursor/4,step=g->cursor%4,pid=g->children[stage];
                if(g->state==3){
                    if(step==0){int p=kpProc(pid);if((g->started&(1U<<stage)) && p>=0 && gProcesses[p].state!=5)kpAction(4,g->id,pid,1,3,0);else ++g->cursor;}
                    else kpAction(5,g->id,pid,step-1,0,0);
                } else if(step==0){if(stage==0)kpAction(6,g->id,pid,0,4096,0);else {kpAction(1,g->id,pid,0,g->children[stage-1],8);kpWrite(gKernelAction,32,1);kpWrite(gKernelAction,36,4096);}}
                else if(step==1){if(stage+1==g->count){
                    if(g->outputMode){kpAction(1,g->id,g->owner,3,pid,8);kpWrite(gKernelAction,32,1);kpWrite(gKernelAction,36,4096);}
                    else {kpAction(2,g->id,pid,1,g->owner,4);kpWrite(gKernelAction,32,1);}
                }else ++g->cursor;}
                else if(step==2){kpAction(2,g->id,pid,2,g->owner,4);kpWrite(gKernelAction,32,2);}
                else {kpAction(3,g->id,pid,1,32,0);unsigned int len=kpArgs(g,stage);kpWrite(gKernelAction,28,len);gActionBytes=32+len;}
            }
            if(!gActionBytes && g->state==3 && g->outputBound)kpAction(5,g->id,g->owner,3,0,0);
            if(!gActionBytes){if(g->state==3)kpComplete(i);else {g->state=2;for(int j=0;j<g->count;++j){int p=kpProc(g->children[j]);if(p>=0)gProcesses[p].state=2;}
                int owner=kpProc(g->owner);if(g->outputMode && owner>=0)gProcesses[owner].state=2;}}
        }
    }
    for(int i=0;i<gActionBytes;++i)gKernelBuffer[i]=gKernelAction[i];return gActionBytes;
}
MAIA_KERNEL_EXPORT int maia_kernel_action_result(int id,int status)
{
    if(!gActionBytes || kpRead(gKernelAction,8)!=static_cast<unsigned int>(id))return -7;
    if(status>0)return -1;
    if(gActionGroup>=0){KernelGroup* g=gGroups+gActionGroup;
        // A start may complete after parent cancellation; retain it for rollback.
        if(!status && kpRead(gKernelAction,4)==3){for(int j=0;j<g->count;++j)if(g->children[j]==static_cast<int>(kpRead(gKernelAction,16)))g->started|=1U<<j;}
        int ownerRelease=kpRead(gKernelAction,4)==5 && kpRead(gKernelAction,16)==static_cast<unsigned int>(g->owner) && kpRead(gKernelAction,20)==3;
        if(!status && g->outputMode && kpRead(gKernelAction,4)==1 && kpRead(gKernelAction,16)==static_cast<unsigned int>(g->owner))g->outputBound=1;
        if(!status && ownerRelease){g->outputBound=0;g->outputCleanup=2;}
        if(status && g->state==1)kpRollback(gActionGroup);
        else if(g->state==gActionState && !(status && ownerRelease))++g->cursor;
    }else if(gActionBoot>=0){KernelProcess* p=gProcesses+gActionBoot;
        // Boot pipes address both peers; acknowledge the stable owner identity.
        if(p->pid!=gActionBootPid) {gActionBytes=0;return 0;}
        if(gActionAbort)p->state=0;
        else if(status){p->aborting=1;int io=kpProc(p->io);if(io>=0)gProcesses[io].aborting=1;}
        else {++p->bootCursor;if(p->bootCursor==4 && p->ready){p->state=2;int io=kpProc(p->io);if(io>=0 && gProcesses[io].ready)gProcesses[io].state=2;}}
    }
    gActionBytes=0;return 0;
}
MAIA_KERNEL_EXPORT int maia_kernel_process_exit(int pid,int status,int trapped)
{
    int p=kpProc(pid);if(p<0)return -7;gProcesses[p].state=5;
    int child=0;
    for(int i=0;i<4;++i){KernelGroup* g=gGroups+i;if(!g->state)continue;
        if(g->owner==pid){if(g->state==4 && !g->outputBound){kpReap(i);continue;}kpRollback(i);}
        for(int j=0;j<g->count;++j)if(g->children[j]==pid){child=1;g->exits[j]=status;if(trapped)kpRollback(i);}
        if(g->state==2){int live=0;for(int j=0;j<g->count;++j){int item=kpProc(g->children[j]);if(item>=0 && gProcesses[item].state!=5)live=1;}if(!live)kpComplete(i);}
    }
    if(!child)gProcesses[p].state=0;return 0;
}
MAIA_KERNEL_EXPORT int maia_kernel_next_runnable(void)
{
    for(unsigned int i=0;i<16;++i){unsigned int index=gRunnableCursor++%16;KernelProcess* p=gProcesses+index;if(p->state==2 && p->role!=0)return p->pid;}return 0;
}
MAIA_KERNEL_EXPORT int maia_kernel_pipeline_cancel(int caller,int group)
{
    int index=kpGroup(group);if(index<0)return -7;
    if(gGroups[index].owner!=caller)return -3;
    kpRollback(index);return 0;
}
MAIA_KERNEL_EXPORT int maia_kernel_pipeline_wait(int caller,int group,int capacity)
{
    int index=kpGroup(group);if(index<0)return -7;KernelGroup* g=gGroups+index;
    if(g->owner!=caller)return -3;
    if(capacity<16 || capacity>48)return -1;
    if(g->state!=4)return -6;
    unsigned int length=16+g->count*8;if(capacity<static_cast<int>(length))return -4;
    if(g->outputBound){g->outputCleanup=1;return -6;}
    kpWrite(gKernelBuffer,0,1);kpWrite(gKernelBuffer,4,g->id);kpWrite(gKernelBuffer,8,g->count);
    kpWrite(gKernelBuffer,12,g->failed?1:g->exits[g->count-1]);
    for(int j=0;j<g->count;++j){kpWrite(gKernelBuffer,16+j*8,g->children[j]);kpWrite(gKernelBuffer,20+j*8,g->exits[j]);}
    kpReap(index);return length;
}
#endif
