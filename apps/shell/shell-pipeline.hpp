/* Execution adapter for the generated Pipeline/SimpleCommand tree. */
static void pipelinePut(unsigned int at,unsigned int value)
{
    for(unsigned int i=0;i<4;++i)gPipelinePlan[at+i]=static_cast<uint8_t>(value>>(i*8));
}
static void pipelineError(const char* text) {writeText(2,text);completeCommand();}
static void beginPipeline(unsigned int count)
{
    gPipelineOutput=gRedirectFlags?1:0;gPipelineDrained=0;
    if(gPipelineOutput){if(count<2){pipelineError("shell: invalid redirection\n");return;}--count;}
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
    unsigned int base=gPipelineOutput?24:16;
    unsigned int start=base+gPipelineStageCount*8+count*8,position=start;
    pipelinePut(0,gPipelineOutput?2:1);
    if(gPipelineOutput){pipelinePut(16,1);pipelinePut(20,0);}
    pipelinePut(4,gPipelineStageCount);pipelinePut(8,count);
    for(unsigned int s=0;s<gPipelineStageCount;++s){pipelinePut(base+s*8,first[s]);pipelinePut(base+4+s*8,sizes[s]);}
    for(unsigned int i=0;i<count;++i){const char* word=gCommandWords+i*kMaxWordBytes;unsigned int length=textLength(word);
        pipelinePut(base+gPipelineStageCount*8+i*8,position);pipelinePut(base+4+gPipelineStageCount*8+i*8,length);
        for(unsigned int j=0;j<length;++j)gPipelinePlan[position++]=word[j];}
    pipelinePut(12,position-start);
    if(position>1536){pipelineError("shell: pipeline plan limit exceeded\n");return;}
    // Do not consume or close an unrelated owner endpoint on a failed bind.
    if(gPipelineOutput && maia_stream_read(3,static_cast<int32_t>(reinterpret_cast<uintptr_t>(gReadBuffer)),0)!=-7){
        pipelineError("shell: pipeline output busy\n");return;
    }
    if(gPipelineOutput && !beginCommandOutput(gCommandWords+count*kMaxWordBytes)){completeCommand();return;}
    int group=maia_pipeline_start(static_cast<int32_t>(reinterpret_cast<uintptr_t>(gPipelinePlan)),position);
    if(group<=0){pipelineError("shell: pipeline launch failed\n");return;}gPipelineGroup=group;
}
static void resumePipeline(void)
{
    if(gPipelineOutput && !gPipelineDrained){
        int bytes=maia_stream_read(3,static_cast<int32_t>(reinterpret_cast<uintptr_t>(gReadBuffer)),kReadBufferBytes);
        if(bytes==-6)return;
        if(bytes>0 && bytes<=static_cast<int>(kReadBufferBytes)){writeBytes(1,reinterpret_cast<const char*>(gReadBuffer),bytes);return;}
        int closed=maia_stream_close(3);gPipelineDrained=1;
        if(bytes!=0 || closed<0){
            if(bytes!=-7)writeText(2,"shell: pipeline output read failed\n");
            maia_pipeline_cancel(gPipelineGroup);
        }
    }
    int count=maia_pipeline_wait(gPipelineGroup,static_cast<int32_t>(reinterpret_cast<uintptr_t>(gPipelineResult)),48);
    if(count==-6)return;
    if(count<32 || count>48 || directoryUint32(gPipelineResult)!=1 || directoryUint32(gPipelineResult+4)!=static_cast<unsigned int>(gPipelineGroup)
        || directoryUint32(gPipelineResult+8)!=gPipelineStageCount || 16+gPipelineStageCount*8!=static_cast<unsigned int>(count)){
        gFatal=1;return;
    }
    gPipelineGroup=0;gPipelineOutput=0;gPipelineDrained=0;
    if(directoryUint32(gPipelineResult+12))writeText(2,"shell: pipeline failed\n");
    completeCommand();
}
