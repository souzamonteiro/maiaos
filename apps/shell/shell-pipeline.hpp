/* Execution adapter for the generated Pipeline/SimpleCommand tree. */
static void pipelinePut(unsigned int at,unsigned int value)
{
    for(unsigned int i=0;i<4;++i)gPipelinePlan[at+i]=static_cast<uint8_t>(value>>(i*8));
}
static void pipelineError(const char* text) {writeText(2,text);completeCommand();}
static void beginPipeline(unsigned int count)
{
    unsigned int first[4],sizes[4];
    for(unsigned int i=0;i<4;++i){first[i]=0;sizes[i]=0;}
    for(unsigned int i=0;i<count;++i){unsigned int stage=gExpandedStage[i];if(stage>=gPipelineStageCount){pipelineError("shell: invalid pipeline\n");return;}
        if(!sizes[stage])first[stage]=i;++sizes[stage];}
    for(unsigned int s=0;s<gPipelineStageCount;++s){
        if(!sizes[s] || (!s && sizes[s]<2) || !textEquals(gCommandWords+first[s]*kMaxWordBytes,"cat")) {pipelineError("shell: unsupported pipeline command\n");return;}
        for(unsigned int j=1;j<sizes[s];++j){char* word=gCommandWords+(first[s]+j)*kMaxWordBytes;
            if(word[0]=='-'){pipelineError("shell: unsupported pipeline command\n");return;}
            if(!resolvePath(word) || textLength(gResolvedPath)>=kMaxWordBytes){pipelineError("shell: pipeline path limit exceeded\n");return;}
            for(unsigned int k=0;k<=textLength(gResolvedPath);++k)word[k]=gResolvedPath[k];
        }
    }
    unsigned int start=16+gPipelineStageCount*8+count*8,position=start;
    pipelinePut(0,1);pipelinePut(4,gPipelineStageCount);pipelinePut(8,count);
    for(unsigned int s=0;s<gPipelineStageCount;++s){pipelinePut(16+s*8,first[s]);pipelinePut(20+s*8,sizes[s]);}
    for(unsigned int i=0;i<count;++i){const char* word=gCommandWords+i*kMaxWordBytes;unsigned int length=textLength(word);
        pipelinePut(16+gPipelineStageCount*8+i*8,position);pipelinePut(20+gPipelineStageCount*8+i*8,length);
        for(unsigned int j=0;j<length;++j)gPipelinePlan[position++]=word[j];}
    pipelinePut(12,position-start);
    int group=maia_pipeline_start(static_cast<int32_t>(reinterpret_cast<uintptr_t>(gPipelinePlan)),position);
    if(group<=0){pipelineError("shell: pipeline launch failed\n");return;}gPipelineGroup=group;
}
static void resumePipeline(void)
{
    int count=maia_pipeline_wait(gPipelineGroup,static_cast<int32_t>(reinterpret_cast<uintptr_t>(gPipelineResult)),48);
    if(count==-6)return;
    if(count<32 || count>48 || directoryUint32(gPipelineResult)!=1 || directoryUint32(gPipelineResult+4)!=static_cast<unsigned int>(gPipelineGroup)
        || directoryUint32(gPipelineResult+8)!=gPipelineStageCount || 16+gPipelineStageCount*8!=static_cast<unsigned int>(count)){
        gFatal=1;return;
    }
    gPipelineGroup=0;
    if(directoryUint32(gPipelineResult+12))writeText(2,"shell: pipeline failed\n");
    completeCommand();
}
