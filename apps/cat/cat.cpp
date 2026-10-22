#include <stdint.h>
#define MAIA_IMPORT(module_name, field_name) __attribute__((import_module(module_name), import_name(field_name)))
extern "C" {
MAIA_IMPORT("maia.stream","read") int32_t stream_read(int32_t fd,int32_t ptr,int32_t count);
MAIA_IMPORT("maia.stream","write") int32_t stream_write(int32_t fd,int32_t ptr,int32_t count);
MAIA_IMPORT("maia.stream","close") int32_t stream_close(int32_t fd);
MAIA_IMPORT("maia.vfs","open") int32_t file_open(int32_t ptr,int32_t count,int32_t flags);
MAIA_IMPORT("maia.vfs","read") int32_t file_read(int32_t fd,int32_t ptr,int32_t count);
MAIA_IMPORT("maia.vfs","close") int32_t file_close(int32_t fd);
MAIA_IMPORT("maia.process","args_size") int32_t args_size(void);
MAIA_IMPORT("maia.process","args_copy") int32_t args_copy(int32_t ptr,int32_t count);
MAIA_IMPORT("maia.process","exit") void process_exit(int32_t status);
}
static uint8_t gArgs[1536],gBytes[128];
static unsigned int gArgCount=0,gArgIndex=1,gOffset=0,gCount=0;
static const char gErrorText[]="cat: file or stream error\n";
static int gFile=-1,gDone=0,gStatus=0,gDiagnostic=0,gStopped=0;
static unsigned int read32(const uint8_t* p){return static_cast<unsigned int>(p[0])|(static_cast<unsigned int>(p[1])<<8)|(static_cast<unsigned int>(p[2])<<16)|(static_cast<unsigned int>(p[3])<<24);}
static int pointer(const void* p){return static_cast<int>(reinterpret_cast<uintptr_t>(p));}
static void stop(void){if(gFile>=0){file_close(gFile);gFile=-1;}for(int i=0;i<3;++i)stream_close(i);gStopped=1;process_exit(gStatus);}
extern "C" __attribute__((visibility("default"))) void maia_app_start(void)
{
    int length=args_size();if(length<8 || length>1536 || args_copy(pointer(gArgs),length)!=length){gStatus=1;gDone=1;gDiagnostic=1;return;}
    gArgCount=read32(gArgs+4);if(read32(gArgs)!=1 || !gArgCount || gArgCount>12 || 8+gArgCount*8>static_cast<unsigned int>(length)){gStatus=1;gDone=1;gDiagnostic=1;return;}
    unsigned int position=8+gArgCount*8;
    for(unsigned int i=0;i<gArgCount;++i){unsigned int offset=read32(gArgs+8+i*8),bytes=read32(gArgs+12+i*8);
        if(offset!=position || bytes>95 || position>static_cast<unsigned int>(length) || bytes>static_cast<unsigned int>(length)-position){gStatus=1;gDone=1;gDiagnostic=1;return;}position+=bytes;}
    if(position!=static_cast<unsigned int>(length)){gStatus=1;gDone=1;gDiagnostic=1;}
}
extern "C" __attribute__((visibility("default"))) void maiaos_step(void)
{
    if(gStopped)return;
    for(unsigned int budget=0;budget<16;++budget){
        if(gDiagnostic){int n=stream_write(2,pointer(gErrorText)+gDiagnostic-1,sizeof(gErrorText)-gDiagnostic);
            if(n==-6)return;if(n<=0){gStatus=1;stop();return;}gDiagnostic+=n;if(gDiagnostic<static_cast<int>(sizeof(gErrorText)))return;gDiagnostic=0;}
        if(gOffset<gCount){int n=stream_write(1,pointer(gBytes+gOffset),gCount-gOffset);if(n==-6)return;if(n<=0 || static_cast<unsigned int>(n)>gCount-gOffset){gStatus=1;stop();return;}gOffset+=n;continue;}
        gOffset=0;gCount=0;
        if(gDone){stop();return;}
        if(gArgCount>1 && gFile<0){if(gArgIndex==gArgCount){gDone=1;continue;}
            unsigned int at=8+gArgIndex*8,offset=read32(gArgs+at),length=read32(gArgs+at+4);++gArgIndex;
            gFile=file_open(pointer(gArgs+offset),length,1);if(gFile<=0){gFile=-1;gStatus=1;gDiagnostic=1;continue;}}
        int n=gArgCount==1?stream_read(0,pointer(gBytes),128):file_read(gFile,pointer(gBytes),128);
        if(n==-6)return;if(n>0 && n<=128){gCount=n;continue;}
        if(gFile>=0){file_close(gFile);gFile=-1;}else gDone=1;
        if(n<0 || n>128){gStatus=1;gDiagnostic=1;}
    }
}
